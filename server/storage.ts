import { users, type User, type InsertUser, ChatSession, InsertChatSession, Message, InsertMessage } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(userId: number, status: string): Promise<User | undefined>;
  
  // Chat sessions
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: number): Promise<ChatSession | undefined>;
  getChatSessionsByCustomerId(customerId: number): Promise<ChatSession[]>;
  getChatSessionsByAgentId(agentId: number): Promise<ChatSession[]>;
  getChatSessionsByStatus(status: string): Promise<ChatSession[]>;
  updateChatSession(id: number, data: Partial<InsertChatSession> & { endedAt?: Date }): Promise<ChatSession>;
  
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesBySessionId(sessionId: number): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chatSessions: Map<number, ChatSession>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.chatSessions = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentMessageId = 1;
    
    // Initialize with some sample data
    this.initializeData();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = {
      ...insertUser,
      id,
      createdAt: now,
      status: "offline"
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserStatus(userId: number, status: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = { ...user, status };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  // Chat session methods
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const id = this.currentSessionId++;
    const now = new Date();
    const chatSession: ChatSession = {
      ...session,
      id,
      startedAt: now,
      endedAt: null
    };
    this.chatSessions.set(id, chatSession);
    return chatSession;
  }
  
  async getChatSession(id: number): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }
  
  async getChatSessionsByCustomerId(customerId: number): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(
      (session) => session.customerId === customerId
    );
  }
  
  async getChatSessionsByAgentId(agentId: number): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(
      (session) => session.agentId === agentId && session.status !== "ended"
    );
  }
  
  async getChatSessionsByStatus(status: string): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(
      (session) => session.status === status
    );
  }
  
  async updateChatSession(id: number, data: Partial<InsertChatSession> & { endedAt?: Date }): Promise<ChatSession> {
    const session = this.chatSessions.get(id);
    if (!session) {
      throw new Error(`Chat session with id ${id} not found`);
    }
    
    const updatedSession = { ...session, ...data };
    this.chatSessions.set(id, updatedSession);
    return updatedSession;
  }
  
  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const now = new Date();
    const newMessage: Message = {
      ...message,
      id,
      timestamp: now,
      isRead: false
    };
    this.messages.set(id, newMessage);
    return newMessage;
  }
  
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  
  async getMessagesBySessionId(sessionId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, isRead: true };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }
  
  // Initialize with sample data
  private initializeData() {
    // Create sample agents
    const agent1: User = {
      id: this.currentUserId++,
      username: "sarah_agent",
      password: "password123",
      role: "agent",
      displayName: "Sarah Williams",
      email: "sarah@support.com",
      phone: "+1 (555) 987-6543",
      status: "online",
      avatarInitials: "SW",
      createdAt: new Date()
    };
    
    const agent2: User = {
      id: this.currentUserId++,
      username: "alex_agent",
      password: "password123",
      role: "agent",
      displayName: "Alex Johnson",
      email: "alex@support.com",
      phone: "+1 (555) 456-7890",
      status: "online",
      avatarInitials: "AJ",
      createdAt: new Date()
    };
    
    // Create sample customers
    const customer1: User = {
      id: this.currentUserId++,
      username: "john_customer",
      password: "password123",
      role: "customer",
      displayName: "John Doe",
      email: "john.doe@example.com",
      phone: "+1 (555) 123-4567",
      status: "offline",
      avatarInitials: "JD",
      createdAt: new Date(new Date().setMonth(new Date().getMonth() - 2)) // 2 months ago
    };
    
    const customer2: User = {
      id: this.currentUserId++,
      username: "alice_customer",
      password: "password123",
      role: "customer",
      displayName: "Alice Smith",
      email: "alice@example.com",
      phone: "+1 (555) 234-5678",
      status: "offline",
      avatarInitials: "AS",
      createdAt: new Date(new Date().setMonth(new Date().getMonth() - 1)) // 1 month ago
    };
    
    // Add users to map
    this.users.set(agent1.id, agent1);
    this.users.set(agent2.id, agent2);
    this.users.set(customer1.id, customer1);
    this.users.set(customer2.id, customer2);
  }
}

export const storage = new MemStorage();
