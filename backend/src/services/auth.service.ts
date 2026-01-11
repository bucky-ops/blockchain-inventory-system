import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ethers } from "ethers";
import { logger } from "@/utils/logger";
import { databaseService } from "./databaseService";
import { blockchainService } from "./blockchainService";
import { redisService } from "./redis.service";
import {
  AuthenticationError,
  ValidationError,
  ConflictError,
} from "@/middleware/errorHandler";

interface AuthUser {
  id: string;
  wallet_address: string;
  email?: string;
  username: string;
  role: "admin" | "manager" | "user" | "viewer";
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface LoginRequest {
  address: string;
  signature: string;
  nonce: string;
}

interface RegisterRequest {
  address: string;
  username: string;
  email?: string;
  role: "admin" | "manager" | "user" | "viewer";
  adminSignature?: string;
}

class AuthenticationService {
  private readonly JWT_SECRET =
    process.env.JWT_SECRET || "default-secret-change-in-production";
  private readonly JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ||
    "default-refresh-secret-change-in-production";
  private readonly ACCESS_TOKEN_EXPIRY = "15m";
  private readonly REFRESH_TOKEN_EXPIRY = "7d";
  private readonly NONCE_EXPIRY = 300; // 5 minutes

  /**
   * Generate and store nonce for message signing
   */
  public async generateNonce(
    address: string,
  ): Promise<{ nonce: string; expiresAt: string }> {
    try {
      if (!address || !ethers.isAddress(address)) {
        throw new ValidationError("Valid wallet address is required");
      }

      // Generate cryptographically secure nonce
      const nonce = crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + this.NONCE_EXPIRY * 1000);

      // Store nonce in Redis with expiry
      await redisService.setNonce(address, nonce, this.NONCE_EXPIRY);

      logger.info("Nonce generated", { address, nonce });

      return {
        nonce,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      logger.error("Error generating nonce:", error);
      throw error;
    }
  }

  /**
   * Authenticate user with signed message
   */
  public async login(
    loginData: LoginRequest,
  ): Promise<{ user: AuthUser; tokens: AuthTokens; sessionId: string }> {
    try {
      const { address, signature, nonce } = loginData;

      if (!address || !signature || !nonce) {
        throw new ValidationError("Address, signature, and nonce are required");
      }

      // Validate address format
      if (!ethers.isAddress(address)) {
        throw new ValidationError("Invalid wallet address");
      }

      // Verify nonce from Redis
      const storedNonce = await redisService.getNonce(address);
      if (!storedNonce || storedNonce !== nonce) {
        throw new AuthenticationError("Invalid or expired nonce");
      }

      // Verify signature
      const message = `Login to Blockchain Inventory System: ${nonce}`;
      const recoveredAddress = blockchainService.verifyMessageSignature(
        message,
        signature,
      );

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new AuthenticationError("Invalid signature");
      }

      // Get user from database
      let user = await databaseService.getUserByWalletAddress(address);
      if (!user) {
        throw new AuthenticationError("User not found. Please register first.");
      }

      if (!user.is_active) {
        throw new AuthenticationError("User account is not active");
      }

      // Verify role on blockchain (if contracts are available)
      const blockchainRole = await blockchainService.getUserRole(address);
      if (blockchainRole && blockchainRole !== user.role) {
        logger.warn("Role mismatch between database and blockchain", {
          address,
          dbRole: user.role,
          blockchainRole,
        });
        // Optionally update database role to match blockchain
        // user = await databaseService.updateUser(user.id, { role: blockchainRole });
      }

      // Consume nonce from Redis
      await redisService.deleteNonce(address);

      // Create session
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const sessionData = {
        id: sessionId,
        user_id: user.id,
        session_token: sessionId,
        wallet_address: address,
        expires_at: expiresAt,
        is_active: true,
        ip_address: null, // Will be set by middleware
        user_agent: null, // Will be set by middleware
        created_at: new Date(),
        last_accessed: new Date(),
      };

      await databaseService.createSession(sessionData);
      await redisService.setSession(sessionId, sessionData, 86400); // 24 hours

      // Update user last login
      await databaseService.updateUser(user.id, { last_login: new Date() });
      await redisService.cacheUser(user.id, user, 3600); // 1 hour

      // Generate tokens
      const tokens = this.generateTokens(user, sessionId);

      // Store refresh token in Redis
      await redisService.set(
        `refresh_token:${address}`,
        tokens.refreshToken,
        7 * 24 * 60 * 60,
      ); // 7 days

      logger.info("User logged in", {
        address,
        role: user.role,
        sessionId,
      });

      return {
        user: this.sanitizeUser(user),
        tokens,
        sessionId,
      };
    } catch (error) {
      logger.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Register new user (admin only or self-registration)
   */
  public async register(
    registerData: RegisterRequest,
    adminAddress?: string,
  ): Promise<AuthUser> {
    try {
      const { address, username, email, role, adminSignature } = registerData;

      if (!address || !username || !role) {
        throw new ValidationError("Address, username, and role are required");
      }

      if (!ethers.isAddress(address)) {
        throw new ValidationError("Invalid wallet address");
      }

      // Check if user already exists
      const existingUser =
        await databaseService.getUserByWalletAddress(address);
      if (existingUser) {
        throw new ConflictError("User already exists");
      }

      // If admin registration, verify admin signature
      if (adminSignature && adminAddress) {
        const adminMessage = `Register user: ${address} as ${role}`;
        const recoveredAdminAddress = blockchainService.verifyMessageSignature(
          adminMessage,
          adminSignature,
        );

        if (
          recoveredAdminAddress.toLowerCase() !== adminAddress.toLowerCase()
        ) {
          throw new AuthenticationError("Invalid admin signature");
        }

        // Verify admin has admin role
        const admin =
          await databaseService.getUserByWalletAddress(adminAddress);
        if (!admin || admin.role !== "admin") {
          throw new AuthenticationError("Only admins can register users");
        }
      }

      // Create user in database
      const userData = {
        wallet_address: address,
        email,
        username,
        role,
        is_active: true,
      };

      const user = await databaseService.createUser(userData);

      // Register user on blockchain (if contracts are available)
      try {
        const txHash = await blockchainService.registerUser(
          address,
          username,
          role,
        );
        logger.info("User registered on blockchain", { address, txHash });

        // Update user with blockchain transaction
        await databaseService.updateUser(user.id, {
          blockchain_tx_hash: txHash,
          blockchain_timestamp: new Date(),
        });
      } catch (blockchainError) {
        logger.warn("Failed to register user on blockchain:", blockchainError);
        // Continue with database registration only
      }

      // Cache user in Redis
      await redisService.cacheUser(user.id, user, 3600);

      logger.info("User registered", {
        address,
        username,
        role,
        registeredBy: adminAddress || "self",
      });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Logout user and invalidate session
   */
  public async logout(sessionToken: string): Promise<void> {
    try {
      if (!sessionToken) {
        return; // Already logged out
      }

      // Get session from Redis
      const session = await redisService.getSession(sessionToken);
      if (session) {
        // Deactivate session in database
        await databaseService.invalidateSession(sessionToken);

        // Remove session from Redis
        await redisService.deleteSession(sessionToken);

        // Remove refresh token
        await redisService.del(`refresh_token:${session.wallet_address}`);

        logger.info("User logged out", { address: session.wallet_address });
      }
    } catch (error) {
      logger.error("Logout error:", error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      if (!refreshToken) {
        throw new AuthenticationError("Refresh token is required");
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;

      // Check if refresh token is still valid in Redis
      const storedToken = await redisService.get(
        `refresh_token:${decoded.address}`,
      );
      if (storedToken !== refreshToken) {
        throw new AuthenticationError("Invalid refresh token");
      }

      // Get user from database or cache
      let user = await redisService.getCachedUser(decoded.id);
      if (!user) {
        user = await databaseService.getUserByWalletAddress(decoded.address);
        if (!user || !user.is_active) {
          throw new AuthenticationError("User not found or inactive");
        }
        await redisService.cacheUser(user.id, user, 3600);
      }

      // Generate new access token
      const tokens = this.generateTokens(user, decoded.sessionId);

      logger.info("Token refreshed", { address: decoded.address });

      return tokens;
    } catch (error) {
      logger.error("Token refresh error:", error);
      throw new AuthenticationError("Invalid or expired refresh token");
    }
  }

  /**
   * Validate access token and return user
   */
  public async validateToken(
    token: string,
  ): Promise<{ user: AuthUser; sessionId: string }> {
    try {
      if (!token) {
        throw new AuthenticationError("Token is required");
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;

      // Get user from cache or database
      let user = await redisService.getCachedUser(decoded.id);
      if (!user) {
        user = await databaseService.getUserById(decoded.id);
        if (!user || !user.is_active) {
          throw new AuthenticationError("User not found or inactive");
        }
        await redisService.cacheUser(user.id, user, 3600);
      }

      // Verify session is still active
      const session = await redisService.getSession(decoded.sessionId);
      if (
        !session ||
        !session.is_active ||
        new Date(session.expires_at) < new Date()
      ) {
        throw new AuthenticationError("Session expired or invalid");
      }

      // Update session last accessed
      await databaseService.updateSessionLastAccessed(decoded.sessionId);
      await redisService.setSession(decoded.sessionId, session, 86400);

      return {
        user: this.sanitizeUser(user),
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      logger.error("Token validation error:", error);
      throw new AuthenticationError("Invalid or expired token");
    }
  }

  /**
   * Get user profile
   */
  public async getProfile(userId: string): Promise<AuthUser> {
    try {
      let user = await redisService.getCachedUser(userId);
      if (!user) {
        user = await databaseService.getUserById(userId);
        if (!user) {
          throw new AuthenticationError("User not found");
        }
        await redisService.cacheUser(user.id, user, 3600);
      }

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error("Get profile error:", error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  public async updateProfile(
    userId: string,
    updates: Partial<AuthUser>,
  ): Promise<AuthUser> {
    try {
      const user = await databaseService.updateUser(userId, updates);

      // Update cache
      await redisService.cacheUser(user.id, user, 3600);

      logger.info("User profile updated", { userId, updates });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error("Update profile error:", error);
      throw error;
    }
  }

  /**
   * Verify message signature
   */
  public verifySignature(
    message: string,
    signature: string,
    address: string,
  ): { isValid: boolean; recoveredAddress?: string } {
    try {
      if (!message || !signature || !address) {
        throw new ValidationError(
          "Message, signature, and address are required",
        );
      }

      const recoveredAddress = blockchainService.verifyMessageSignature(
        message,
        signature,
      );
      const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();

      return {
        isValid,
        recoveredAddress: isValid ? recoveredAddress : undefined,
      };
    } catch (error) {
      logger.error("Signature verification error:", error);
      return { isValid: false };
    }
  }

  /**
   * Invalidate all user sessions
   */
  public async invalidateAllUserSessions(
    userId: string,
    walletAddress: string,
  ): Promise<void> {
    try {
      // Invalidate in database
      await databaseService.invalidateAllUserSessions(userId);

      // Invalidate in Redis
      await redisService.invalidateUserSessions(userId);

      // Remove refresh token
      await redisService.del(`refresh_token:${walletAddress}`);

      // Remove user from cache
      await redisService.invalidateUserCache(userId);

      logger.info("All user sessions invalidated", { userId, walletAddress });
    } catch (error) {
      logger.error("Invalidate sessions error:", error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(user: AuthUser, sessionId: string): AuthTokens {
    const accessToken = jwt.sign(
      {
        id: user.id,
        address: user.wallet_address,
        email: user.email,
        username: user.username,
        role: user.role,
        sessionId,
      },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        address: user.wallet_address,
        sessionId,
        type: "refresh",
      },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      tokenType: "Bearer",
    };
  }

  /**
   * Sanitize user object for client response
   */
  private sanitizeUser(user: AuthUser): AuthUser {
    return {
      id: user.id,
      wallet_address: user.wallet_address,
      email: user.email,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}

export const authService = new AuthenticationService();
