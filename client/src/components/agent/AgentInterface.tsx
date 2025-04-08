import { useState } from "react";
import { AgentHeader } from "./AgentHeader";
import { ChatList } from "./ChatList";
import { AgentStatus } from "./AgentStatus";
import { ChatSessionWithDetails } from "@/lib/types";

interface AgentInterfaceProps {
  agentName: string;
  avatarInitials: string;
  isOnline: boolean;
  activeSessions: ChatSessionWithDetails[];
  waitingSessions: ChatSessionWithDetails[];
  activeSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  className?: string;
}

export function AgentInterface({
  agentName,
  avatarInitials,
  isOnline,
  activeSessions,
  waitingSessions,
  activeSessionId,
  onSelectSession,
  className
}: AgentInterfaceProps) {
  return (
    <div className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col ${className}`}>
      <AgentHeader 
        agentName={agentName}
        avatarInitials={avatarInitials}
        isOnline={isOnline}
      />
      
      <ChatList 
        activeSessions={activeSessions}
        waitingSessions={waitingSessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
      />
      
      <AgentStatus 
        name={agentName}
        avatarInitials={avatarInitials}
      />
    </div>
  );
}
