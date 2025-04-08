import { useEffect, useState, useCallback, useRef } from 'react';
import { socketClient } from '@/lib/socket';
import { messageTypes, type User, type Message, type ChatSession } from '@shared/schema';
import { ChatMessageWithUser, ChatSessionWithDetails, WebSocketConnectionStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debounce } from '@/lib/utils';

interface UseChatOptions {
  userId: number | 0; // Allow 0 as default for anonymous customers
  role: 'customer' | 'agent';
  autoConnect?: boolean;
}

interface UseChatResult {
  connectionStatus: WebSocketConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  activeSession: ChatSessionWithDetails | null;
  waitingSessions: ChatSessionWithDetails[];
  activeSessions: ChatSessionWithDetails[];
  messages: ChatMessageWithUser[];
  sendMessage: (content: string) => void;
  setActiveSession: (sessionId: number) => void;
  isTyping: { [sessionId: number]: boolean };
  sendTypingIndicator: (isTyping: boolean) => void;
  assignSession: (sessionId: number) => Promise<void>;
  endSession: (sessionId: number) => Promise<void>;
}

export function useChat({ userId, role, autoConnect = true }: UseChatOptions): UseChatResult {
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>({
    connected: false,
    reconnecting: false,
    error: null,
  });
  
  const [activeSession, setActiveSession] = useState<ChatSessionWithDetails | null>(null);
  const [waitingSessions, setWaitingSessions] = useState<ChatSessionWithDetails[]>([]);
  const [activeSessions, setActiveSessions] = useState<ChatSessionWithDetails[]>([]);
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [isTyping, setIsTyping] = useState<{ [sessionId: number]: boolean }>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Store user details for use in resolving message sender info
  const userDetails = useRef<Map<number, User>>(new Map());
  
  // Get user details
  const { data: userData } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });
  
  useEffect(() => {
    if (userData && 'id' in userData) {
      userDetails.current.set(userData.id, userData);
    }
  }, [userData]);
  
  // Reference to previous connection status for toast notifications
  const prevConnectedRef = useRef<boolean>(false);
  
  // Handle connection status changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;
    
    // Update the connection status
    setConnectionStatus(prev => ({
      ...prev,
      connected,
      reconnecting: !connected && prev.connected,
    }));
    
    // Show appropriate toast message
    if (!connected && wasConnected) {
      toast({
        title: "Connection Lost",
        description: "Attempting to reconnect...",
        variant: "destructive",
      });
    } else if (connected && !wasConnected) {
      toast({
        title: "Connected",
        description: "Successfully connected to the chat server.",
      });
    }
  }, [toast]);
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    socketClient.connect(userId, role);
  }, [userId, role]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    socketClient.disconnect();
  }, []);
  
  // Auto-connect on mount if enabled
  useEffect(() => {
    // For customers, allow connection even with userId=0 (anonymous)
    if (autoConnect && (userId || role === 'customer') && role) {
      connect();
    }
    
    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, userId, role, connect, disconnect]);
  
  // Process chat history
  const processChatHistory = useCallback((sessionData: any) => {
    if (role === 'customer') {
      // For customers, there's only one active session
      if (sessionData.session && sessionData.messages) {
        setActiveSession(sessionData.session);
        setMessages(sessionData.messages.map((msg: Message) => ({
          ...msg,
          user: userDetails.current.get(msg.senderId)
        })));
      }
    } else if (role === 'agent') {
      // For agents, there are waiting and active sessions
      if (sessionData.waitingSessions) {
        console.log(`Received ${sessionData.waitingSessions.length} waiting sessions`);
        setWaitingSessions(sessionData.waitingSessions);
      }
      
      if (sessionData.activeSessions) {
        console.log(`Received ${sessionData.activeSessions.length} active sessions`);
        
        // Make sure we track all users involved in these sessions
        sessionData.activeSessions.forEach((session: ChatSession) => {
          // Track customer info for this session
          if (session.customerId && !userDetails.current.has(session.customerId)) {
            apiRequest('GET', `/api/users/${session.customerId}`)
              .then(res => res.json())
              .then(user => {
                if (user && user.id) {
                  userDetails.current.set(user.id, user);
                }
              })
              .catch(err => console.error("Error fetching customer details:", err));
          }
          
          // Track agent info for this session
          if (session.agentId && !userDetails.current.has(session.agentId)) {
            apiRequest('GET', `/api/users/${session.agentId}`)
              .then(res => res.json())
              .then(user => {
                if (user && user.id) {
                  userDetails.current.set(user.id, user);
                }
              })
              .catch(err => console.error("Error fetching agent details:", err));
          }
        });
        
        setActiveSessions(sessionData.activeSessions);
      }
    }
  }, [role]);
  
  // Process chat message
  const processChatMessage = useCallback((messageData: any) => {
    const { message, session } = messageData;
    
    if (!message || !session) {
      console.error("Received invalid chat message data", messageData);
      return;
    }
    
    // For customer role, show messages in either:
    // 1. Their active session, or
    // 2. A session where they are the customer (even if not active yet)
    // For agent role:
    // 1. Show messages in any active session they're viewing
    // 2. Show messages if they're the assigned agent
    // 3. Show all messages for all chats (agents can see all chat sessions)
    const shouldShowMessage = 
      (role === 'customer' && (
        activeSession?.id === session.id || 
        session.customerId === userId
      )) ||
      (role === 'agent' && (
        // Show if it's the active session being viewed
        activeSession?.id === session.id ||
        // Or if this agent is assigned to the session
        session.agentId === userId ||
        // Or if the message is for the active session
        (activeSession && message && message.sessionId === activeSession.id)
      ));
      
    console.log("Processing chat message:", {
      messageId: message?.id,
      senderId: message?.senderId,
      sessionId: session?.id,
      role,
      userId,
      activeSessionId: activeSession?.id,
      agentId: session?.agentId,
      showCondition: shouldShowMessage
    });
    
    // Store sender information if not already stored
    if (message.senderId && !userDetails.current.has(message.senderId)) {
      // For customers with temporary IDs (negative values), we don't need to fetch user details
      if (message.senderId < 0) {
        userDetails.current.set(message.senderId, {
          id: message.senderId,
          username: "Customer",
          role: "customer",
          // Add required fields for User type
          password: "",
          displayName: "Anonymous Customer",
          email: "",
          phone: null,
          status: "online",
          avatarInitials: "AC",
          createdAt: new Date()
        } as User);
      } else {
        apiRequest('GET', `/api/users/${message.senderId}`)
          .then(res => res.json())
          .then(user => {
            if (user && user.id) {
              userDetails.current.set(user.id, user);
            }
          })
          .catch(err => console.error("Error fetching user details:", err));
      }
    }
    
    // Add message to the list if it should be shown for this user
    if (shouldShowMessage) {
      // Make sure we don't duplicate messages
      setMessages(prev => {
        // Check if this message already exists
        const exists = prev.some(m => m.id === message.id);
        if (exists) return prev;
        
        return [
          ...prev,
          {
            ...message,
            user: userDetails.current.get(message.senderId)
          }
        ];
      });
      
      // Reset typing indicator
      setIsTyping(prev => ({
        ...prev,
        [session.id]: false
      }));
      
      // If this is a customer receiving a message from an agent, update the active session
      if (role === 'customer' && message.senderId !== userId) {
        setActiveSession(session);
      }
    }
    
    // Update session in list if needed
    if (session) {
      if (role === 'agent') {
        if (session.status === 'waiting') {
          setWaitingSessions(prev => {
            const exists = prev.some(s => s.id === session.id);
            if (exists) {
              return prev.map(s => s.id === session.id ? session : s);
            } else {
              return [...prev, session];
            }
          });
        } else if (session.status === 'active') {
          setWaitingSessions(prev => prev.filter(s => s.id !== session.id));
          
          setActiveSessions(prev => {
            const exists = prev.some(s => s.id === session.id);
            if (exists) {
              return prev.map(s => s.id === session.id ? session : s);
            } else {
              return [...prev, session];
            }
          });
        } else if (session.status === 'ended') {
          setActiveSessions(prev => prev.filter(s => s.id !== session.id));
          
          if (activeSession?.id === session.id) {
            setActiveSession(null);
          }
        }
      } else if (role === 'customer') {
        setActiveSession(prev => prev?.id === session.id ? session : prev);
      }
    }
  }, [role, userId, activeSession]);
  
  // Process typing indicator
  const processTypingIndicator = useCallback((data: any) => {
    const { sessionId, userId: typingUserId, isTyping: userIsTyping } = data;
    
    // Only set typing indicator for messages from the other participant
    if (typingUserId !== userId) {
      setIsTyping(prev => ({
        ...prev,
        [sessionId]: userIsTyping
      }));
    }
  }, [userId]);
  
  // Process session assigned
  const processSessionAssigned = useCallback((data: any) => {
    const { session } = data;
    
    if (!session) return;
    
    console.log("Processing session update:", {
      sessionId: session.id,
      status: session.status,
      agentId: session.agentId,
      customerId: session.customerId
    });
    
    if (role === 'customer') {
      // For customers, only update if this session is relevant to them
      if (session.customerId === userId) {
        setActiveSession(session);
        
        if (session.agentId && !userDetails.current.has(session.agentId)) {
          apiRequest('GET', `/api/users/${session.agentId}`)
            .then(res => res.json())
            .then(user => {
              userDetails.current.set(user.id, user);
            })
            .catch(console.error);
        }
      }
    } else if (role === 'agent') {
      // For agents, update all sessions in their lists
      if (session.status === 'waiting') {
        setWaitingSessions(prev => {
          const exists = prev.some(s => s.id === session.id);
          if (exists) {
            return prev.map(s => s.id === session.id ? session : s);
          } else {
            return [...prev, session];
          }
        });
      } else if (session.status === 'active') {
        // Remove from waiting list if it was there
        setWaitingSessions(prev => prev.filter(s => s.id !== session.id));
        
        // Add to active list if not already there
        setActiveSessions(prev => {
          const exists = prev.some(s => s.id === session.id);
          if (exists) {
            return prev.map(s => s.id === session.id ? session : s);
          } else {
            return [...prev, session];
          }
        });
        
        // Fetch customer details if needed
        if (session.customerId && !userDetails.current.has(session.customerId)) {
          apiRequest('GET', `/api/users/${session.customerId}`)
            .then(res => res.json())
            .then(user => {
              if (user && user.id) {
                userDetails.current.set(user.id, user);
              }
            })
            .catch(console.error);
        }
        
        // Fetch agent details if needed
        if (session.agentId && !userDetails.current.has(session.agentId)) {
          apiRequest('GET', `/api/users/${session.agentId}`)
            .then(res => res.json())
            .then(user => {
              if (user && user.id) {
                userDetails.current.set(user.id, user);
              }
            })
            .catch(console.error);
        }
      } else if (session.status === 'ended') {
        // Remove from active list
        setActiveSessions(prev => prev.filter(s => s.id !== session.id));
        
        // Clear active session if it was selected
        if (activeSession?.id === session.id) {
          setActiveSession(null);
        }
      }
    }
  }, [role, userId, activeSession]);
  
  // Register WebSocket event handlers
  useEffect(() => {
    const handlersToUnregister = [
      socketClient.onConnectionChange(handleConnectionChange),
      socketClient.onMessage(messageTypes.CHAT_HISTORY, (message) => processChatHistory(message.data)),
      socketClient.onMessage(messageTypes.CHAT_MESSAGE, (message) => processChatMessage(message.data)),
      socketClient.onMessage(messageTypes.TYPING, (message) => processTypingIndicator(message.data)),
      socketClient.onMessage(messageTypes.SESSION_ASSIGNED, (message) => processSessionAssigned(message.data)),
      socketClient.onMessage(messageTypes.ERROR, (message) => {
        toast({
          title: "Error",
          description: message.data.message || "An error occurred",
          variant: "destructive",
        });
      }),
    ];
    
    return () => {
      handlersToUnregister.forEach(unregister => unregister());
    };
  }, [
    handleConnectionChange, 
    processChatHistory, 
    processChatMessage, 
    processTypingIndicator, 
    processSessionAssigned, 
    toast
  ]);
  
  // Send a message
  const sendMessage = useCallback((content: string) => {
    if (!activeSession) {
      toast({
        title: "No active session",
        description: "Cannot send message without an active session",
        variant: "destructive",
      });
      return;
    }
    
    socketClient.sendChatMessage(activeSession.id, content);
  }, [activeSession, toast]);
  
  // Send typing indicator (debounced)
  const debouncedTypingIndicator = useCallback(
    debounce((sessionId: number, isTyping: boolean) => {
      socketClient.sendTypingIndicator(sessionId, isTyping);
    }, 300),
    []
  );
  
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!activeSession) return;
    debouncedTypingIndicator(activeSession.id, isTyping);
  }, [activeSession, debouncedTypingIndicator]);
  
  // Set the active chat session
  const changeActiveSession = useCallback((sessionId: number) => {
    // Find the session in waiting or active sessions
    const session = 
      waitingSessions.find(s => s.id === sessionId) ||
      activeSessions.find(s => s.id === sessionId);
    
    console.log("Selecting active session:", { 
      sessionId, 
      foundSession: session ? true : false, 
      waitingSessionsCount: waitingSessions.length,
      activeSessionsCount: activeSessions.length 
    });
    
    if (session) {
      setActiveSession(session);
      
      // Load messages for this session
      apiRequest('GET', `/api/chat-sessions/${sessionId}/messages`)
        .then(res => res.json())
        .then(messages => {
          setMessages(messages.map((msg: Message) => ({
            ...msg,
            user: userDetails.current.get(msg.senderId)
          })));
        })
        .catch(error => {
          console.error("Error loading messages:", error);
          toast({
            title: "Error",
            description: "Failed to load messages",
            variant: "destructive",
          });
        });
    }
  }, [waitingSessions, activeSessions, toast]);
  
  // Mutation for assigning a session to an agent
  const assignSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      await apiRequest('PUT', `/api/chat-sessions/${sessionId}/assign`, { agentId: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat-sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to assign session",
        variant: "destructive",
      });
    }
  });
  
  // Mutation for ending a session
  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      await apiRequest('PUT', `/api/chat-sessions/${sessionId}/end`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat-sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to end session",
        variant: "destructive",
      });
    }
  });
  
  const assignSession = useCallback(async (sessionId: number) => {
    await assignSessionMutation.mutateAsync(sessionId);
  }, [assignSessionMutation]);
  
  const endSession = useCallback(async (sessionId: number) => {
    await endSessionMutation.mutateAsync(sessionId);
  }, [endSessionMutation]);
  
  return {
    connectionStatus,
    connect,
    disconnect,
    activeSession,
    waitingSessions,
    activeSessions,
    messages,
    sendMessage,
    setActiveSession: changeActiveSession,
    isTyping,
    sendTypingIndicator,
    assignSession,
    endSession,
  };
}
