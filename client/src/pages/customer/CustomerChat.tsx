import { useState, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

export default function CustomerChat() {
  const { user } = useAuth();
  
  // Allow anonymous customer access (userId will be assigned temporarily by the server)
  // If user is logged in, we'll use their ID
  // We'll pass 0 when not authenticated, and server will assign a temporary ID
  const userId = user?.id || 0; 
  const role = "customer";
  
  const [showInfo, setShowInfo] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true); // Start as connecting
  const [forceReconnect, setForceReconnect] = useState(0); // Counter to force reconnection
  
  // If user is logged in as an agent, redirect them to the agent interface
  if (user && user.role === "agent") {
    return <Redirect to="/agent" />;
  }
  
  // Always use autoConnect: true for customer interface for reliability
  const {
    connectionStatus,
    activeSession,
    messages,
    sendMessage,
    isTyping,
    sendTypingIndicator,
    connect,
  } = useChat({
    userId,
    role,
    autoConnect: true, // Always connect automatically
  });
  
  // Log connection status and reconnect if needed
  useEffect(() => {
    console.log("Customer chat connection status:", {
      connected: connectionStatus.connected,
      reconnecting: connectionStatus.reconnecting,
      error: connectionStatus.error,
      hasActiveSession: activeSession !== null
    });
    
    // If connection is lost, and we have no active session, try to reconnect
    if (!connectionStatus.connected && !connectionStatus.reconnecting && !activeSession) {
      // We'll wait 3 seconds between reconnection attempts
      const reconnectTimer = setTimeout(() => {
        console.log("Attempting to reconnect customer chat...");
        connect();
        setForceReconnect(prev => prev + 1); // Increment to force effect to run again
      }, 3000);
      
      return () => clearTimeout(reconnectTimer);
    }
    
    // Update connection state for UI
    setIsConnecting(!connectionStatus.connected);
    
  }, [connectionStatus, connect, activeSession, forceReconnect]);
  
  const { data: userData, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });
  
  const handleSendMessage = (content: string) => {
    sendMessage(content);
  };
  
  const handleTyping = (isTyping: boolean) => {
    sendTypingIndicator(isTyping);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-md p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }
  
  // Check if there's an active session to determine if we should show a welcome message
  const hasActiveSession = activeSession !== null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {!hasActiveSession ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-lg text-center">
            <h1 className="text-3xl font-bold mb-4">Welcome to Customer Support</h1>
            <p className="text-lg mb-6">
              Our team is ready to assist you. Type your message below to start a chat with our support team.
            </p>
            <div className="bg-primary/10 p-4 rounded-md mb-6">
              <p className="font-medium">Tips for faster support:</p>
              <ul className="text-left list-disc pl-6 mt-2">
                <li>Describe your issue in detail</li>
                <li>Include any relevant information like order numbers</li>
                <li>Be specific about what you need help with</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}
      
      <ChatInterface
        role="customer"
        session={activeSession}
        messages={messages}
        isTyping={isTyping[activeSession?.id || 0] || false}
        connectionStatus={{
          // Always pass the actual connection status for proper notifications
          // but never disable the input based on connection (ChatInput handles this separately)
          connected: connectionStatus.connected,
          reconnecting: connectionStatus.reconnecting, 
          error: connectionStatus.error
        }}
        userId={userId}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onToggleInfo={() => setShowInfo(!showInfo)}
      />
    </div>
  );
}
