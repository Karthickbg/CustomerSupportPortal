import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { publishMessage, subscribeToChannel } from "./redis";
import { insertUserSchema, insertChatSessionSchema, insertMessageSchema, messageTypes } from "@shared/schema";
import { handleConnection, processChatMessage, processTypingIndicator, assignSession, endChatSession, handleDisconnect } from "./chat";

// Extend WebSocket type to include our custom properties
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userData?: {
    userId: number;
    role: string;
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  
  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  });
  
  app.get("/api/users", async (_req, res) => {
    try {
      // This is a simplified implementation for demo purposes
      // In a real app, you'd want to paginate and filter this endpoint
      const users = Array.from(storage.getAllUsers());
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });
  
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  
  // Chat session routes
  app.post("/api/chat-sessions", async (req, res) => {
    try {
      const sessionData = insertChatSessionSchema.parse(req.body);
      const session = await storage.createChatSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create chat session" });
      }
    }
  });
  
  app.get("/api/chat-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getChatSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chat session" });
    }
  });
  
  app.get("/api/chat-sessions/:id/messages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const messages = await storage.getMessagesBySessionId(id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to get messages" });
    }
  });
  
  app.put("/api/chat-sessions/:id/assign", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { agentId } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ error: "Agent ID is required" });
      }
      
      const updatedSession = await assignSession(agentId, id);
      res.json(updatedSession);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign chat session" });
    }
  });
  
  app.put("/api/chat-sessions/:id/end", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedSession = await endChatSession(id);
      res.json(updatedSession);
    } catch (error) {
      res.status(500).json({ error: "Failed to end chat session" });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server with more lenient settings
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Increase ping timeout for intermittent connections
    clientTracking: true,
    // Allow more time for connections to initialize
    perMessageDeflate: {
      zlibDeflateOptions: {
        // Use smaller chunks for better performance and less memory usage
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Below options are needed for server-side performance
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10
    }
  });
  
  // Set up a heartbeat interval to keep connections alive
  function heartbeat(this: any) {
    this.isAlive = true;
  }

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((socket: WebSocket) => {
      const extSocket = socket as ExtendedWebSocket;
      if (extSocket.isAlive === false) {
        // Get user info before closing connection
        const userId = extSocket.userData?.userId;
        if (userId) {
          handleDisconnect(userId);
        }
        return socket.terminate();
      }

      extSocket.isAlive = false;
      socket.ping();
    });
  }, 30000); // Check every 30 seconds

  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  // Log WebSocket server startup
  console.log("WebSocket server initialized on path: /ws");
  
  // Handle WebSocket connections
  wss.on('connection', (socket: WebSocket, request) => {
    // Cast to our extended type
    const extSocket = socket as ExtendedWebSocket;
    
    // Initialize heartbeat
    extSocket.isAlive = true;
    
    // Using Function.bind to fix 'this' context for the heartbeat function
    extSocket.on('pong', heartbeat.bind(extSocket));
    
    // Parse user ID and role from query string
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const userId = parseInt(url.searchParams.get('userId') || '0');
    const role = url.searchParams.get('role') || '';
    
    // Store user data on the socket for later reference
    extSocket.userData = { userId, role };
    
    // Log connection for debugging
    console.log(`WebSocket connection established: User ${userId} (${role})`);
    
    if (!userId || !['customer', 'agent'].includes(role)) {
      console.log(`Invalid connection attempt: User ${userId} (${role})`);
      socket.send(JSON.stringify({
        type: messageTypes.ERROR,
        data: { message: "Invalid user ID or role" },
        timestamp: Date.now(),
      }));
      socket.close();
      return;
    }
    
    // Update user status to online
    storage.updateUserStatus(userId, "online").then(() => {
      console.log(`User ${userId} (${role}) status updated to online`);
    }).catch(err => {
      console.error(`Failed to update status for user ${userId}:`, err);
    });
    
    // Handle new connection
    handleConnection(socket, userId, role);
    
    // Send a welcome message to confirm connection
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: messageTypes.CONNECTION_ESTABLISHED,
        data: { userId, role },
        timestamp: Date.now(),
      }));
    }
    
    // Handle messages from client
    socket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Log message type for debugging
        console.log(`Received message from User ${userId} (${role}): ${message.type}`);
        
        switch (message.type) {
          case messageTypes.CHAT_MESSAGE:
            await processChatMessage(userId, message);
            break;
          case messageTypes.TYPING:
            await processTypingIndicator(userId, message);
            break;
          case messageTypes.SESSION_ASSIGNED:
            if (role === 'agent') {
              await assignSession(userId, message.data.sessionId);
            }
            break;
          default:
            console.log("Received unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: messageTypes.ERROR,
            data: { message: "Error processing message" },
            timestamp: Date.now(),
          }));
        }
      }
    });
    
    // Handle client disconnect
    socket.on('close', (code, reason) => {
      console.log(`WebSocket connection closed for User ${userId} (${role}): Code ${code}, Reason: ${reason || 'No reason provided'}`);
      handleDisconnect(userId);
    });
  });
  
  // Subscribe to Redis channels for each WebSocket client
  subscribeToChannel("chat:broadcast", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(parsedMessage));
        }
      });
    } catch (error) {
      console.error("Error broadcasting message:", error);
    }
  });

  return httpServer;
}
