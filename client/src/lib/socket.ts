import { messageTypes, WebSocketMessage } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private userId: number | null = null;
  private role: string | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectInterval: number = 3000;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose: boolean = false;

  /**
   * Connect to the WebSocket server with improved reliability
   */
  connect(userId: number, role: string): void {
    console.log(`Attempting to connect as ${role} with userId: ${userId}`);
    
    // For anonymous customers, check localStorage to see if we have a temporary ID
    if (userId === 0 && role === 'customer') {
      // Try to use a stored anonymous ID if we have one to maintain session continuity
      const storedAnonymousId = localStorage.getItem('anonymousCustomerId');
      if (storedAnonymousId) {
        const parsedId = parseInt(storedAnonymousId, 10);
        if (!isNaN(parsedId) && parsedId < 0) {
          // Use the stored ID for reconnection
          userId = parsedId;
          console.log(`Using stored anonymous ID: ${userId} for continuity`);
        }
      }
    }
    
    // Only attempt to connect if we're not already connecting or connected
    if (this.socket) {
      const state = this.socket.readyState;
      
      if (state === WebSocket.OPEN) {
        console.log("WebSocket is already connected, notifying handlers");
        this.notifyConnectionHandlers(true);
        return;
      }
      
      if (state === WebSocket.CONNECTING) {
        console.log("WebSocket is already connecting, waiting for result");
        return;
      }
      
      // Socket is closing or closed, dispose of it and continue
      try {
        console.log("Cleaning up existing socket before reconnecting");
        this.socket.close();
      } catch (e) {
        console.warn("Error closing existing socket:", e);
      }
      this.socket = null;
    }

    // Cancel any pending reconnects
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.userId = userId;
    this.role = role;
    this.intentionalClose = false;

    try {
      // Add timestamp to URL to avoid potential caching issues with WebSocket connections
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const timestamp = Date.now();
      
      // Construct the WebSocket URL
      const host = window.location.host || window.location.hostname || 'localhost';
      const wsUrl = `${protocol}//${host}/ws?userId=${userId}&role=${role}&t=${timestamp}`;
      
      console.log(`Creating WebSocket connection to ${wsUrl}`);
      this.socket = new WebSocket(wsUrl);

      // Connection timeout to prevent hanging in CONNECTING state
      const connectionTimeout = setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.error("WebSocket connection timeout after 5 seconds");
          try {
            this.socket.close();
          } catch (e) {
            console.error("Error closing timed out socket:", e);
          }
          this.socket = null;
          this.notifyConnectionHandlers(false);
          this.reconnect();
        }
      }, 5000);

      this.socket.addEventListener("open", () => {
        clearTimeout(connectionTimeout);
        this.handleOpen();
        
        // Set up regular pings to keep the connection alive
        const pingInterval = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
              // Send a lightweight ping message
              this.socket.send(JSON.stringify({
                type: messageTypes.PING,
                data: { timestamp: Date.now() },
                timestamp: Date.now()
              }));
            } catch (e) {
              console.error("Error sending ping:", e);
              clearInterval(pingInterval);
            }
          } else {
            clearInterval(pingInterval);
          }
        }, 25000); // Every 25 seconds
        
        // Make sure to clear the interval when the socket closes
        if (this.socket) {
          this.socket.addEventListener("close", () => {
            clearInterval(pingInterval);
          }, { once: true });
        }
      });
      
      this.socket.addEventListener("message", this.handleMessage);
      this.socket.addEventListener("close", this.handleClose);
      this.socket.addEventListener("error", (e) => {
        clearTimeout(connectionTimeout);
        this.handleError(e);
      });
    } catch (error) {
      console.error("Error establishing WebSocket connection:", error);
      this.notifyConnectionHandlers(false);
      this.reconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.intentionalClose = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Send a message to the WebSocket server
   */
  send(message: Omit<WebSocketMessage, "timestamp">): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection Error",
        description: "Unable to send message. Please try again.",
        variant: "destructive",
      });
      this.reconnect();
      return;
    }

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now(),
    };

    this.socket.send(JSON.stringify(fullMessage));
  }

  /**
   * Subscribe to a specific message type
   */
  onMessage(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }

    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Check if the socket is connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen = () => {
    console.log("WebSocket connection established");
    
    // Reset reconnect interval to default on successful connection
    this.reconnectInterval = 3000;
    
    this.notifyConnectionHandlers(true);
  };

  /**
   * Handle WebSocket message event
   */
  private handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      
      // For anonymous customers, store the assigned ID when it's sent in CONNECTION_ESTABLISHED
      if (message.type === 'connection_established' && this.role === 'customer') {
        const assignedUserId = message.data?.userId;
        if (assignedUserId && assignedUserId < 0) {
          // Store the temporary ID for reconnection
          console.log(`Storing anonymous customer ID: ${assignedUserId} for reconnection`);
          localStorage.setItem('anonymousCustomerId', assignedUserId.toString());
        }
      }
      
      // Handle pong responses to reset connection timeout timers if needed
      if (message.type === messageTypes.PONG) {
        console.log("Received pong response from server");
        // This message just confirms the server connection is alive
        // No specific action needed beyond the normal message handlers
      }
      
      // Notify all handlers for this message type
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

      // Also notify all handlers subscribed to 'all' messages
      const allHandlers = this.messageHandlers.get("all");
      if (allHandlers) {
        allHandlers.forEach(handler => handler(message));
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  /**
   * Handle WebSocket close event
   */
  private handleClose = (event: CloseEvent) => {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.socket = null;
    this.notifyConnectionHandlers(false);

    if (!this.intentionalClose) {
      this.reconnect();
    }
  };

  /**
   * Handle WebSocket error event
   */
  private handleError = (event: Event) => {
    console.error("WebSocket error:", event);
    this.notifyConnectionHandlers(false);
  };

  /**
   * Attempt to reconnect after connection loss
   */
  private reconnect(): void {
    // Don't attempt to reconnect if:
    // 1. We're already in the process of reconnecting
    // 2. The user explicitly disconnected
    // 3. We don't have role information
    // 4. We need userId for agent role but don't have it
    if (this.reconnectTimeout || 
        this.intentionalClose || 
        !this.role || 
        (this.role === 'agent' && !this.userId)) {
      console.log("Skipping reconnection attempt due to:", {
        alreadyReconnecting: !!this.reconnectTimeout,
        intentionalClose: this.intentionalClose,
        missingRole: !this.role,
        missingAgentId: this.role === 'agent' && !this.userId
      });
      return;
    }

    // No need to clean up localStorage items anymore

    // Set up progressive backoff for reconnection attempts
    // Starting with a short interval (3s) and gradually increasing
    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting to reconnect...");
      this.reconnectTimeout = null;
      
      // Attempt to reconnect
      this.connect(this.userId!, this.role!);
      
      // If we still have issues, the handleClose event will trigger another reconnect
      // with an increased interval (handled in the socket event handlers)
    }, this.reconnectInterval);
    
    // Increase the reconnect interval for progressive backoff
    // but cap it at 30 seconds maximum
    this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, 30000);
  }

  /**
   * Notify all connection handlers of the current connection state
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  /**
   * Send a chat message
   */
  sendChatMessage(sessionId: number, content: string): void {
    this.send({
      type: messageTypes.CHAT_MESSAGE,
      data: {
        sessionId,
        content,
      },
    });
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(sessionId: number, isTyping: boolean): void {
    this.send({
      type: messageTypes.TYPING,
      data: {
        sessionId,
        isTyping,
      },
    });
  }

  /**
   * Request to assign a session to an agent
   */
  requestSessionAssignment(sessionId: number): void {
    this.send({
      type: messageTypes.SESSION_ASSIGNED,
      data: {
        sessionId,
      },
    });
  }

  /**
   * Request to end a session
   */
  requestEndSession(sessionId: number): void {
    this.send({
      type: messageTypes.SESSION_ASSIGNED,
      data: {
        sessionId,
        status: "ended",
      },
    });
  }
}

// Create a singleton instance
export const socketClient = new WebSocketClient();
