import Redis from "ioredis";

// Flag to determine if we're using Redis or a mock implementation
const USE_REDIS = process.env.USE_REDIS === 'true';

// In-memory store for mock implementation
const inMemoryChannels: { [channel: string]: Set<(message: string) => void> } = {};

// Create Redis clients or mock implementations
let publisher: Redis | null = null;
let subscriber: Redis | null = null;

if (USE_REDIS) {
  try {
    // Redis client for publishing messages
    publisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    
    // Redis client for subscribing to messages
    subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    
    // Check Redis connection
    publisher.on("connect", () => {
      console.log("Redis publisher connected");
    });
    
    publisher.on("error", (err) => {
      console.error("Redis publisher error:", err);
    });
    
    subscriber.on("connect", () => {
      console.log("Redis subscriber connected");
    });
    
    subscriber.on("error", (err) => {
      console.error("Redis subscriber error:", err);
    });
  } catch (error) {
    console.error("Failed to initialize Redis, falling back to mock implementation:", error);
    publisher = null;
    subscriber = null;
  }
} else {
  console.log("Using mock Redis implementation for development");
}

// Publish a message to a channel
export const publishMessage = async (channel: string, message: any): Promise<void> => {
  const messageStr = JSON.stringify(message);
  
  if (publisher) {
    try {
      await publisher.publish(channel, messageStr);
    } catch (error) {
      console.error("Error publishing message:", error);
      // Fall back to in-memory implementation
      publishToInMemoryChannel(channel, messageStr);
    }
  } else {
    // Use in-memory implementation
    publishToInMemoryChannel(channel, messageStr);
  }
};

// Subscribe to a channel
export const subscribeToChannel = (channel: string, callback: (message: string) => void): void => {
  if (subscriber) {
    try {
      subscriber.subscribe(channel, (err) => {
        if (err) {
          console.error(`Error subscribing to channel ${channel}:`, err);
          // Fall back to in-memory implementation
          subscribeToInMemoryChannel(channel, callback);
          return;
        }
        console.log(`Subscribed to channel: ${channel}`);
      });
    
      subscriber.on("message", (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      console.error(`Error setting up subscription to channel ${channel}:`, error);
      // Fall back to in-memory implementation
      subscribeToInMemoryChannel(channel, callback);
    }
  } else {
    // Use in-memory implementation
    subscribeToInMemoryChannel(channel, callback);
  }
};

// Unsubscribe from a channel
export const unsubscribeFromChannel = (channel: string): void => {
  if (subscriber) {
    try {
      subscriber.unsubscribe(channel, (err) => {
        if (err) {
          console.error(`Error unsubscribing from channel ${channel}:`, err);
          return;
        }
        console.log(`Unsubscribed from channel: ${channel}`);
      });
    } catch (error) {
      console.error(`Error unsubscribing from channel ${channel}:`, error);
    }
  }
  
  // Also clean up in-memory subscription
  unsubscribeFromInMemoryChannel(channel);
};

// Helper functions for in-memory publish/subscribe implementation
function publishToInMemoryChannel(channel: string, message: string): void {
  if (!inMemoryChannels[channel]) return;
  
  console.log(`[Mock Redis] Publishing to channel ${channel}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
  
  inMemoryChannels[channel].forEach(callback => {
    try {
      callback(message);
    } catch (error) {
      console.error(`Error in callback for channel ${channel}:`, error);
    }
  });
}

function subscribeToInMemoryChannel(channel: string, callback: (message: string) => void): void {
  if (!inMemoryChannels[channel]) {
    inMemoryChannels[channel] = new Set();
  }
  
  console.log(`[Mock Redis] Subscribed to channel: ${channel}`);
  inMemoryChannels[channel].add(callback);
}

function unsubscribeFromInMemoryChannel(channel: string): void {
  if (inMemoryChannels[channel]) {
    delete inMemoryChannels[channel];
    console.log(`[Mock Redis] Unsubscribed from channel: ${channel}`);
  }
}
