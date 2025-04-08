import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("customer"),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("offline"),
  avatarInitials: text("avatar_initials"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => users.id),
  agentId: integer("agent_id").references(() => users.id),
  status: text("status").notNull().default("waiting"), // waiting, active, ended
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessions.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  displayName: true,
  email: true,
  phone: true,
  avatarInitials: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  customerId: true,
  agentId: true,
  status: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  sessionId: true,
  senderId: true,
  content: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// WebSocket message types
export const messageTypes = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CHAT_MESSAGE: 'chat_message',
  STATUS_CHANGE: 'status_change',
  TYPING: 'typing',
  CHAT_HISTORY: 'chat_history',
  SESSION_ASSIGNED: 'session_assigned',
  CONNECTION_ESTABLISHED: 'connection_established',
  ERROR: 'error',
};

export type WebSocketMessage = {
  type: string;
  data: any;
  timestamp: number;
};
