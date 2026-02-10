import Redis from "ioredis";
import { logger } from "@/utils/logger";

class RedisService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on("connect", () => {
      logger.info("✅ Redis connected successfully");
      this.isConnected = true;
    });

    this.client.on("error", (error) => {
      logger.error("❌ Redis connection error:", error);
      this.isConnected = false;
    });

    this.client.on("close", () => {
      logger.warn("⚠️ Redis connection closed");
      this.isConnected = false;
    });

    this.client.on("reconnecting", () => {
      logger.info("🔄 Redis reconnecting...");
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      logger.error("Error disconnecting from Redis:", error);
      throw error;
    }
  }

  public isRedisConnected(): boolean {
    return this.isConnected;
  }

  // Session Management
  public async setSession(
    sessionToken: string,
    sessionData: any,
    ttlSeconds: number = 86400,
  ): Promise<void> {
    try {
      const key = `session:${sessionToken}`;
      await this.client.setex(key, ttlSeconds, JSON.stringify(sessionData));
    } catch (error) {
      logger.error("Error setting session in Redis:", error);
      throw error;
    }
  }

  public async getSession(sessionToken: string): Promise<any | null> {
    try {
      const key = `session:${sessionToken}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Error getting session from Redis:", error);
      return null;
    }
  }

  public async deleteSession(sessionToken: string): Promise<void> {
    try {
      const key = `session:${sessionToken}`;
      await this.client.del(key);
    } catch (error) {
      logger.error("Error deleting session from Redis:", error);
      throw error;
    }
  }

  public async invalidateUserSessions(userId: string): Promise<void> {
    try {
      const pattern = `session:*`;
      const keys = await this.client.keys(pattern);

      for (const key of keys) {
        const sessionData = await this.client.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.user_id === userId) {
            await this.client.del(key);
          }
        }
      }
    } catch (error) {
      logger.error("Error invalidating user sessions in Redis:", error);
      throw error;
    }
  }

  // User Caching
  public async cacheUser(
    userId: string,
    userData: any,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    try {
      const key = `user:${userId}`;
      await this.client.setex(key, ttlSeconds, JSON.stringify(userData));
    } catch (error) {
      logger.error("Error caching user in Redis:", error);
      throw error;
    }
  }

  public async getCachedUser(userId: string): Promise<any | null> {
    try {
      const key = `user:${userId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Error getting cached user from Redis:", error);
      return null;
    }
  }

  public async invalidateUserCache(userId: string): Promise<void> {
    try {
      const key = `user:${userId}`;
      await this.client.del(key);
    } catch (error) {
      logger.error("Error invalidating user cache in Redis:", error);
      throw error;
    }
  }

  // Inventory Caching
  public async cacheInventoryItem(
    itemId: string,
    itemData: any,
    ttlSeconds: number = 1800,
  ): Promise<void> {
    try {
      const key = `inventory:${itemId}`;
      await this.client.setex(key, ttlSeconds, JSON.stringify(itemData));
    } catch (error) {
      logger.error("Error caching inventory item in Redis:", error);
      throw error;
    }
  }

  public async getCachedInventoryItem(itemId: string): Promise<any | null> {
    try {
      const key = `inventory:${itemId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Error getting cached inventory item from Redis:", error);
      return null;
    }
  }

  public async invalidateInventoryCache(itemId: string): Promise<void> {
    try {
      const key = `inventory:${itemId}`;
      await this.client.del(key);
    } catch (error) {
      logger.error("Error invalidating inventory cache in Redis:", error);
      throw error;
    }
  }

  public async cacheInventoryList(
    cacheKey: string,
    items: any[],
    ttlSeconds: number = 600,
  ): Promise<void> {
    try {
      const key = `inventory_list:${cacheKey}`;
      await this.client.setex(key, ttlSeconds, JSON.stringify(items));
    } catch (error) {
      logger.error("Error caching inventory list in Redis:", error);
      throw error;
    }
  }

  public async getCachedInventoryList(cacheKey: string): Promise<any[] | null> {
    try {
      const key = `inventory_list:${cacheKey}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Error getting cached inventory list from Redis:", error);
      return null;
    }
  }

  // Nonce Management for Blockchain Authentication
  public async setNonce(
    walletAddress: string,
    nonce: string,
    ttlSeconds: number = 300,
  ): Promise<void> {
    try {
      const key = `nonce:${walletAddress}`;
      await this.client.setex(key, ttlSeconds, nonce);
    } catch (error) {
      logger.error("Error setting nonce in Redis:", error);
      throw error;
    }
  }

  public async getNonce(walletAddress: string): Promise<string | null> {
    try {
      const key = `nonce:${walletAddress}`;
      return await this.client.get(key);
    } catch (error) {
      logger.error("Error getting nonce from Redis:", error);
      return null;
    }
  }

  public async deleteNonce(walletAddress: string): Promise<void> {
    try {
      const key = `nonce:${walletAddress}`;
      await this.client.del(key);
    } catch (error) {
      logger.error("Error deleting nonce from Redis:", error);
      throw error;
    }
  }

  // Rate Limiting
  public async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    try {
      const key = `rate_limit:${identifier}`;
      const current = await this.client.incr(key);

      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }

      return current <= limit;
    } catch (error) {
      logger.error("Error checking rate limit in Redis:", error);
      return true; // Allow request if Redis fails
    }
  }

  public async getRateLimitCount(identifier: string): Promise<number> {
    try {
      const key = `rate_limit:${identifier}`;
      const count = await this.client.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      logger.error("Error getting rate limit count from Redis:", error);
      return 0;
    }
  }

  // Cache Management
  public async clearCache(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.error("Error clearing cache in Redis:", error);
      throw error;
    }
  }

  public async getCacheInfo(): Promise<any> {
    try {
      const info = await this.client.info("memory");
      const keyspace = await this.client.info("keyspace");

      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isConnected,
      };
    } catch (error) {
      logger.error("Error getting Redis cache info:", error);
      return null;
    }
  }

  // Health Check
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error("Redis health check failed:", error);
      return false;
    }
  }

  // Generic Cache Operations
  public async set(
    key: string,
    value: any,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      logger.error("Error setting value in Redis:", error);
      throw error;
    }
  }

  public async get(key: string): Promise<any | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Error getting value from Redis:", error);
      return null;
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Error deleting value from Redis:", error);
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Error checking if key exists in Redis:", error);
      return false;
    }
  }

  public async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      logger.error("Error setting expiry in Redis:", error);
      throw error;
    }
  }
}

export const redisService = new RedisService();
