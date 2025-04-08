import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { AgentInterface } from "@/components/agent/AgentInterface";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CustomerInfoSidebar } from "@/components/customer/CustomerInfoSidebar";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentDashboard() {
  // In a real app, you'd get the agent ID from authentication
  // For demo purposes, we're using agent ID 1 (Sarah Williams from sample data)
  const userId = 1;
  const role = "agent";
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(true);
  
  const {
    connectionStatus,
    activeSession,
    waitingSessions,
    activeSessions,
    messages,
    sendMessage,
    isTyping,
    sendTypingIndicator,
    setActiveSession,
    assignSession,
    endSession,
  } = useChat({
    userId,
    role,
    autoConnect: true,
  });
  
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
  
  const handleSelectSession = async (sessionId: number) => {
    // Set the active session
    setActiveSession(sessionId);
    
    // If session is from the waiting queue, assign it to this agent
    const isWaiting = waitingSessions.some(s => s.id === sessionId);
    if (isWaiting) {
      await assignSession(sessionId);
    }
    
    // Hide sidebar on mobile after selecting a session
    setShowSidebar(false);
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
  
  return (
    <div className="flex flex-col md:flex-row h-screen">
      <AgentInterface
        agentName={userData?.displayName || "Support Agent"}
        avatarInitials={userData?.avatarInitials || "SA"}
        isOnline={connectionStatus.connected}
        activeSessions={activeSessions}
        waitingSessions={waitingSessions}
        activeSessionId={activeSession?.id || null}
        onSelectSession={handleSelectSession}
        className={`${showSidebar ? 'block' : 'hidden'} md:block absolute md:relative z-10 h-full md:h-auto w-full md:w-80`}
      />
      
      <ChatInterface
        role="agent"
        session={activeSession}
        messages={messages}
        isTyping={isTyping[activeSession?.id || 0] || false}
        connectionStatus={connectionStatus}
        userId={userId}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onShowSidebar={() => setShowSidebar(true)}
        onToggleInfo={() => setShowCustomerInfo(!showCustomerInfo)}
      />
      
      {activeSession && showCustomerInfo && (
        <CustomerInfoSidebar
          session={activeSession}
          className="hidden md:block w-80"
        />
      )}
    </div>
  );
}
