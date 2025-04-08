import { useState, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerChat() {
  // In a real app, you'd get the customer ID from authentication
  // For demo purposes, we're using customer ID 3 (John Doe from sample data)
  const userId = 3;
  const role = "customer";
  
  const [showInfo, setShowInfo] = useState(false);
  
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
