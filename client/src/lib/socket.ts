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
    // Only attempt to connect if we're not already connecting or connected
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log("Already connecting or connected, skipping new connection attempt");
      return;
    }

    // Cancel any pending reconnects
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
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
      // Add timestamp to URL to avoid potential caching issues with WebSocket connections
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const timestamp = Date.now();
      // Use 0 for the userId param when dealing with anonymous customers
      const userIdParam = userId || 0;
      
      // Make sure we have a valid host - if window.location.host is empty, use default hostname and port
      const host = window.location.host || window.location.hostname || 'localhost';
      
      // Construct the WebSocket URL
      const wsUrl = `${protocol}//${host}/ws?userId=${userIdParam}&role=${role}&t=${timestamp}`;
      
      // Detect and prevent connection to unwanted URLs (like the one with token parameter)
      if (window.WebSocket) {
        // Replace any existing WebSocket prototype connect to prevent unintended connections
        const originalWebSocketConstructor = window.WebSocket;
        
        class SafeWebSocket extends originalWebSocketConstructor {
          constructor(url: string, protocols?: string | string[]) {
            // Check if URL contains 'token=' which is not part of our intended connection
            if (url.includes('token=')) {
              console.error(`Blocking unintended WebSocket connection to: ${url}`);
              // Use our intended URL instead
              super(wsUrl, protocols);
            } else {
              super(url, protocols);
            }
          }
        }
        
        // Only temporarily replace the WebSocket constructor to catch potential issues
        window.WebSocket = SafeWebSocket as any;
        
        console.log(`Connecting to WebSocket at ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
        
        // Restore the original WebSocket constructor
        window.WebSocket = originalWebSocketConstructor;
      } else {
        console.log(`Connecting to WebSocket at ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
      }

      // Shorter timeout (5 seconds instead of 8) for faster retries
      const connectionTimeout = setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.log("WebSocket connection timeout after 5 seconds - retrying");
          try {
            this.socket.close();
          } catch (e) {
            console.error("Error closing socket on timeout:", e);
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
                type: "ping",
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

    // Check if there's any conflicting global variable or localStorage item 
    // that might be interfering with the WebSocket connection
    try {
      // Clean up any potential conflicting localStorage items
      if (localStorage.getItem('wsUrl') || localStorage.getItem('websocket')) {
        console.log("Cleaning up potentially conflicting localStorage WebSocket items");
        localStorage.removeItem('wsUrl');
        localStorage.removeItem('websocket');
      }
    } catch (e) {
      console.error("Error checking localStorage:", e);
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
