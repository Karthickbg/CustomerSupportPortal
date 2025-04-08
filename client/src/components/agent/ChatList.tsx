import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChatSessionWithDetails } from "@/lib/types";
import { cn, getRelativeTimeString, truncateText } from "@/lib/utils";

interface ChatListProps {
  activeSessions: ChatSessionWithDetails[];
  waitingSessions: ChatSessionWithDetails[];
  activeSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
}

export function ChatList({
  activeSessions,
  waitingSessions,
  activeSessionId,
  onSelectSession
}: ChatListProps) {
  const [activeTab, setActiveTab] = useState<"active" | "queue">("active");
  
  const renderChatItem = (session: ChatSessionWithDetails, isActive: boolean) => {
    const customer = session.customer;
    const lastMessage = session.lastMessage;
    const isOnline = customer?.status === "online";
    const initials = customer?.avatarInitials || "?";
    
    return (
      <div 
        key={session.id}
        className={cn(
          "p-4 border-b border-gray-100 flex items-center space-x-3 hover:bg-gray-50 cursor-pointer",
          isActive ? "bg-blue-50" : ""
        )}
        onClick={() => onSelectSession(session.id)}
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-primary font-medium">
            {initials}
          </div>
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
            isOnline ? "bg-online" : "bg-offline"
          )}></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <p className="font-medium truncate">{customer?.displayName || "Anonymous"}</p>
            <span className="text-xs text-textMedium">
              {lastMessage ? getRelativeTimeString(lastMessage.timestamp) : "New"}
            </span>
          </div>
          <p className="text-xs text-textMedium truncate">
            {lastMessage 
              ? truncateText(lastMessage.content, 40)
              : "New conversation"
            }
          </p>
        </div>
      </div>
    );
  };
  
  return (
    <>
      <div className="flex border-b border-gray-200">
        <Button
          variant="ghost"
          className={cn(
            "flex-1 py-3 px-4 font-medium rounded-none",
            activeTab === "active" 
              ? "text-primary border-b-2 border-primary" 
              : "text-textMedium"
          )}
          onClick={() => setActiveTab("active")}
        >
          Active Chats
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "flex-1 py-3 px-4 font-medium rounded-none",
            activeTab === "queue" 
              ? "text-primary border-b-2 border-primary" 
              : "text-textMedium"
          )}
          onClick={() => setActiveTab("queue")}
        >
          Queue
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {activeTab === "active" ? (
          activeSessions.length > 0 ? (
            activeSessions.map(session => renderChatItem(session, session.id === activeSessionId))
          ) : (
            <div className="p-4 text-center text-textMedium">
              No active chats
            </div>
          )
        ) : (
          waitingSessions.length > 0 ? (
            waitingSessions.map(session => renderChatItem(session, session.id === activeSessionId))
          ) : (
            <div className="p-4 text-center text-textMedium">
              No customers waiting
            </div>
          )
        )}
      </div>
    </>
  );
}
