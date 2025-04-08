import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

export default function CustomerChat() {
  const { user } = useAuth();
  
  // Use the logged-in user's ID or redirect to login
  const userId = user?.id || 0;
  const role = "customer";
  
  const [showInfo, setShowInfo] = useState(false);
  
  // If not logged in or not a customer, redirect to auth page
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  // Only customers should access this page
  if (user.role !== "customer") {
    return <Redirect to="/agent" />;
  }
  
  const {
    connectionStatus,
    activeSession,
    messages,
    sendMessage,
    isTyping,
    sendTypingIndicator,
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <ChatInterface
        role="customer"
        session={activeSession}
        messages={messages}
        isTyping={isTyping[activeSession?.id || 0] || false}
        connectionStatus={connectionStatus}
        userId={userId}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onToggleInfo={() => setShowInfo(!showInfo)}
      />
    </div>
  );
}
