import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

export default function CustomerChat() {
  const { user } = useAuth();
  
  // For customers, we'll use a hardcoded ID (3 for John Doe) if not logged in
  // In a real app, you'd handle this differently, perhaps with a session ID
  const userId = 3; // John Doe customer ID
  const role = "customer";
  
  const [showInfo, setShowInfo] = useState(false);
  
  // If user is logged in as an agent, redirect them to the agent interface
  if (user && user.role === "agent") {
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
        connectionStatus={connectionStatus}
        userId={userId}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onToggleInfo={() => setShowInfo(!showInfo)}
      />
    </div>
  );
}
