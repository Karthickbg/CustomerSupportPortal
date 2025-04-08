import { User, ChatSession, Message, WebSocketMessage } from "@shared/schema";

export interface Agent extends User {
  role: "agent";
}

export interface Customer extends User {
  role: "customer";
}

export type ChatUser = Agent | Customer;

export interface ChatMessageWithUser extends Message {
  user?: ChatUser;
}

export interface ChatSessionWithDetails extends ChatSession {
  customer?: Customer;
  agent?: Agent;
  lastMessage?: ChatMessageWithUser;
}

export interface MessageEvent {
  sessionId: number;
  content: string;
}

export interface TypingEvent {
  sessionId: number;
  isTyping: boolean;
}

export interface WebSocketConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
}
