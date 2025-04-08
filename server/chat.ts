import { User, ChatSession, Message, InsertMessage, InsertChatSession, WebSocketMessage, messageTypes } from "@shared/schema";
import { storage } from "./storage";
import { publishMessage } from "./redis";
import { WebSocket } from "ws";

// Map to store active connections
interface Connection {
  userId: number;
  role: string;
  socket: WebSocket;
}

const connections = new Map<number, Connection>();
const sessions = new Map<number, ChatSession>();
const userSessions = new Map<number, number[]>();

// Handle a new WebSocket connection
export const handleConnection = (socket: WebSocket, userId: number, role: string) => {
  connections.set(userId, { userId, role, socket });
  
  // Send initial status message
  sendMessage(socket, {
    type: messageTypes.CONNECT,
    data: { userId, role, status: "online" },
    timestamp: Date.now(),
  });
  
  if (role === "customer") {
    handleCustomerConnection(userId, socket);
  } else if (role === "agent") {
    handleAgentConnection(userId, socket);
  }
};

// Handle when a customer connects
const handleCustomerConnection = async (userId: number, socket: WebSocket) => {
  try {
    console.log(`Handling customer connection for ${userId} (${userId <= 0 ? 'anonymous' : 'registered'})`);
    
    // Check if customer has any active sessions
    const customerSessions = await storage.getChatSessionsByCustomerId(userId);
    
    if (customerSessions.length === 0) {
      // For anonymous users (userId <= 0), we'll still create a session but log it
      if (userId <= 0) {
        console.log(`Creating new session for anonymous customer with temp ID: ${userId}`);
      }
      
      // Create a new chat session
      const sessionData: InsertChatSession = {
        customerId: userId,
        status: "waiting",
      };
      
      const session = await storage.createChatSession(sessionData);
      console.log(`Created new session #${session.id} for customer ${userId}`);
      
      sessions.set(session.id, session);
      
      if (!userSessions.has(userId)) {
        userSessions.set(userId, []);
      }
      userSessions.get(userId)?.push(session.id);
      
      // Broadcast to all agents that there's a new waiting customer
      broadcastToAgents({
        type: messageTypes.SESSION_ASSIGNED,
        data: { session },
        timestamp: Date.now(),
      });
      
      // Send session info to customer
      sendMessage(socket, {
        type: messageTypes.CHAT_HISTORY,
        data: { 
          session,
          messages: []
        },
        timestamp: Date.now(),
      });
    } else {
      // Send existing session data and chat history
      const activeSession = customerSessions.find(s => s.status !== "ended");
      if (activeSession) {
        console.log(`Found active session #${activeSession.id} for customer ${userId}`);
        const messages = await storage.getMessagesBySessionId(activeSession.id);
        
        sendMessage(socket, {
          type: messageTypes.CHAT_HISTORY,
          data: { 
            session: activeSession,
            messages 
          },
          timestamp: Date.now(),
        });
        
        // Update session in memory
        sessions.set(activeSession.id, activeSession);
        
        if (!userSessions.has(userId)) {
          userSessions.set(userId, []);
        }
        
        if (!userSessions.get(userId)?.includes(activeSession.id)) {
          userSessions.get(userId)?.push(activeSession.id);
        }
      } else {
        console.log(`No active sessions for customer ${userId}, creating new one`);
        // Create a new session if all previous ones are ended
        const sessionData: InsertChatSession = {
          customerId: userId,
          status: "waiting",
        };
        
        const session = await storage.createChatSession(sessionData);
        sessions.set(session.id, session);
        
        if (!userSessions.has(userId)) {
          userSessions.set(userId, []);
        }
        userSessions.get(userId)?.push(session.id);
        
        // Broadcast to all agents that there's a new waiting customer
        broadcastToAgents({
          type: messageTypes.SESSION_ASSIGNED,
          data: { session },
          timestamp: Date.now(),
        });
        
        // Send session info to customer
        sendMessage(socket, {
          type: messageTypes.CHAT_HISTORY,
          data: { 
            session,
            messages: []
          },
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    console.error("Error in customer connection handler:", error);
    sendMessage(socket, {
      type: messageTypes.ERROR,
      data: { message: "Failed to initialize chat session" },
      timestamp: Date.now(),
    });
  }
};

// Handle when an agent connects
const handleAgentConnection = async (userId: number, socket: WebSocket) => {
  try {
    // Get waiting sessions
    const waitingSessions = await storage.getChatSessionsByStatus("waiting");
    
    // Get active sessions for this agent
    const activeSessions = await storage.getChatSessionsByAgentId(userId);
    
    // Send all sessions to the agent
    sendMessage(socket, {
      type: messageTypes.CHAT_HISTORY,
      data: { 
        waitingSessions,
        activeSessions
      },
      timestamp: Date.now(),
    });
    
    // Update memory with agent's sessions
    activeSessions.forEach(session => {
      sessions.set(session.id, session);
      
      if (!userSessions.has(userId)) {
        userSessions.set(userId, []);
      }
      
      if (!userSessions.get(userId)?.includes(session.id)) {
        userSessions.get(userId)?.push(session.id);
      }
    });
  } catch (error) {
    console.error("Error in agent connection handler:", error);
    sendMessage(socket, {
      type: messageTypes.ERROR,
      data: { message: "Failed to load chat sessions" },
      timestamp: Date.now(),
    });
  }
};

// Process and store a chat message
export const processChatMessage = async (userId: number, message: WebSocketMessage) => {
  try {
    const messageData = message.data;
    const sessionId = messageData.sessionId;
    const content = messageData.content;
    
    // Get session
    const session = sessions.get(sessionId) || await storage.getChatSession(sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Create message
    const newMessage: InsertMessage = {
      sessionId,
      senderId: userId,
      content,
    };
    
    const storedMessage = await storage.createMessage(newMessage);
    
    // If session is waiting and message is from agent, assign agent and update status
    if (session.status === "waiting" && connections.get(userId)?.role === "agent") {
      const updatedSession = await storage.updateChatSession(sessionId, {
        agentId: userId,
        status: "active",
      });
      
      sessions.set(sessionId, updatedSession);
    }
    
    // Publish message to Redis channel for the specific session
    try {
      await publishMessage(`chat:session:${sessionId}`, {
        type: messageTypes.CHAT_MESSAGE,
        data: {
          message: storedMessage,
          session,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.log("Redis publish failed, but message will be delivered directly");
      // The message will still be delivered via direct WebSocket
    }
    
    // Send to both participants
    sendToSessionParticipants(sessionId, {
      type: messageTypes.CHAT_MESSAGE,
      data: {
        message: storedMessage,
        session,
      },
      timestamp: Date.now(),
    });
    
    return storedMessage;
  } catch (error) {
    console.error("Error processing chat message:", error);
    throw error;
  }
};

// Process typing indicator
export const processTypingIndicator = async (userId: number, message: WebSocketMessage) => {
  try {
    const sessionId = message.data.sessionId;
    const isTyping = message.data.isTyping;
    
    // Get session
    const session = sessions.get(sessionId) || await storage.getChatSession(sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Send typing indicator to other participant
    const recipientId = userId === session.customerId ? session.agentId : session.customerId;
    
    if (recipientId && connections.has(recipientId)) {
      const recipientSocket = connections.get(recipientId)?.socket;
      
      if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
        sendMessage(recipientSocket, {
          type: messageTypes.TYPING,
          data: {
            sessionId,
            userId,
            isTyping,
          },
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    console.error("Error processing typing indicator:", error);
    throw error;
  }
};

// Assign a session to an agent
export const assignSession = async (agentId: number, sessionId: number) => {
  try {
    // Update session
    const updatedSession = await storage.updateChatSession(sessionId, {
      agentId,
      status: "active",
    });
    
    sessions.set(sessionId, updatedSession);
    
    if (!userSessions.has(agentId)) {
      userSessions.set(agentId, []);
    }
    
    if (!userSessions.get(agentId)?.includes(sessionId)) {
      userSessions.get(agentId)?.push(sessionId);
    }
    
    // Notify both agent and customer
    sendToSessionParticipants(sessionId, {
      type: messageTypes.SESSION_ASSIGNED,
      data: { session: updatedSession },
      timestamp: Date.now(),
    });
    
    return updatedSession;
  } catch (error) {
    console.error("Error assigning session:", error);
    throw error;
  }
};

// End a chat session
export const endChatSession = async (sessionId: number) => {
  try {
    // Update session
    const updatedSession = await storage.updateChatSession(sessionId, {
      status: "ended",
      endedAt: new Date(),
    });
    
    sessions.set(sessionId, updatedSession);
    
    // Notify both agent and customer
    sendToSessionParticipants(sessionId, {
      type: messageTypes.SESSION_ASSIGNED,
      data: { session: updatedSession },
      timestamp: Date.now(),
    });
    
    return updatedSession;
  } catch (error) {
    console.error("Error ending session:", error);
    throw error;
  }
};

// Handle user disconnect
export const handleDisconnect = (userId: number) => {
  connections.delete(userId);
  
  // If this is an agent, mark them as offline
  storage.updateUserStatus(userId, "offline").catch(error => {
    console.error("Error updating user status:", error);
  });
};

// Send a message to all agents
const broadcastToAgents = (message: WebSocketMessage) => {
  // Convert map entries to array to avoid downlevelIteration issue
  Array.from(connections.entries()).forEach(([userId, connection]) => {
    if (connection.role === "agent" && connection.socket.readyState === WebSocket.OPEN) {
      sendMessage(connection.socket, message);
    }
  });
};

// Send a message to both participants in a session
const sendToSessionParticipants = async (sessionId: number, message: WebSocketMessage) => {
  try {
    const session = sessions.get(sessionId) || await storage.getChatSession(sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Send to customer
    if (connections.has(session.customerId)) {
      const customerSocket = connections.get(session.customerId)?.socket;
      
      if (customerSocket && customerSocket.readyState === WebSocket.OPEN) {
        sendMessage(customerSocket, message);
      }
    }
    
    // Send to agent if assigned
    if (session.agentId && connections.has(session.agentId)) {
      const agentSocket = connections.get(session.agentId)?.socket;
      
      if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
        sendMessage(agentSocket, message);
      }
    }
  } catch (error) {
    console.error("Error sending to session participants:", error);
  }
};

// Helper function to send a WebSocket message
const sendMessage = (socket: WebSocket, message: WebSocketMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};
