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
   * Connect to the WebSocket server
   */
  connect(userId: number, role: string): void {
    // Only attempt to connect if we're not already connecting or connected
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.userId = userId;
    this.role = role;
    this.intentionalClose = false;

    // Close any existing socket before creating a new one
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        console.log("Error closing existing socket:", e);
      }
      this.socket = null;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${userId}&role=${role}`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      this.socket = new WebSocket(wsUrl);

      // Add a connection timeout - if the connection doesn't establish within 8 seconds, try again
      const connectionTimeout = setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.log("WebSocket connection timeout - retrying");
          try {
            this.socket.close();
          } catch (e) {
            console.error("Error closing socket on timeout:", e);
          }
          this.socket = null;
          this.notifyConnectionHandlers(false);
          this.reconnect();
        }
      }, 8000);

      this.socket.addEventListener("open", () => {
        clearTimeout(connectionTimeout);
        this.handleOpen();
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
    // 3. We don't have user information to reconnect with
    if (this.reconnectTimeout || this.intentionalClose || !this.userId || !this.role) {
      return;
    }

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
