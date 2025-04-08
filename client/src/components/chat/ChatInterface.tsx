import { useEffect, useRef } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessage, SystemMessage } from "./ChatMessage";
import { ChatMessageWithUser, ChatSessionWithDetails, WebSocketConnectionStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface ChatInterfaceProps {
  role: "customer" | "agent";
  session: ChatSessionWithDetails | null;
  messages: ChatMessageWithUser[];
  isTyping: boolean;
  connectionStatus: WebSocketConnectionStatus;
  userId: number;
  onSendMessage: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  onShowSidebar?: () => void;
  onToggleInfo?: () => void;
}

export function ChatInterface({
  role,
  session,
  messages,
  isTyping,
  connectionStatus,
  userId,
  onSendMessage,
  onTyping,
  onShowSidebar,
  onToggleInfo
}: ChatInterfaceProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Get conversation start date
  const startDate = session?.startedAt ? formatDate(session.startedAt) : "Today";
  const startTime = session?.startedAt ? new Date(session.startedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : "";
  
  return (
    <div className="flex-1 flex flex-col bg-white">
      <ChatHeader 
        session={session}
        role={role}
        isTyping={isTyping}
        onShowSidebar={onShowSidebar}
        onToggleInfo={onToggleInfo}
      />
      
      <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto chat-container bg-gray-50">
        {session ? (
          <>
            <SystemMessage 
              content={`Conversation started`}
              timestamp={`${startDate} at ${startTime}`}
            />
            
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isCurrentUser={message.senderId === userId}
              />
            ))}
            
            {session.status === "ended" && (
              <SystemMessage content="This conversation has ended" />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">
              {role === "customer" 
                ? "Starting a new conversation..." 
                : "Select a conversation to start chatting"}
            </p>
          </div>
        )}
      </div>
      
      <ChatInput 
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        connectionStatus={connectionStatus}
        disabled={!session || session.status === "ended"}
      />
    </div>
  );
}
