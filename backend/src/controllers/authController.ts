import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { getUserByAddress, createUser, updateUserSession } from '@/services/userService';
import { verifySignatureOnChain, verifyMessageSignature } from '@/services/blockchainService';
import { createNonce, storeNonce, consumeNonce } from '@/services/nonceService';
import { redisClient } from '@/config/redis';
import { 
  AuthenticationError, 
  ValidationError, 
  ConflictError,
  AuthenticatedRequest 
} from '@/middleware/errorHandler';

class AuthController {
  /**
   * Get nonce for message signing
   */
  public getNonce = async (req: Request, res: Response): Promise<void> => {
    try {
      const { address } = req.body;
      
      if (!address || !ethers.isAddress(address)) {
        throw new ValidationError('Valid wallet address is required');
      }

      // Generate and store nonce
      const nonce = createNonce(address);
      await storeNonce(address, nonce);

      logger.info('Nonce generated', { address, nonce });

      res.json({
        success: true,
        data: {
          address,
          nonce,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
        }
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Authenticate user with signed message
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { address, signature, nonce } = req.body;

      if (!address || !signature || !nonce) {
        throw new ValidationError('Address, signature, and nonce are required');
      }

      // Validate address format
      if (!ethers.isAddress(address)) {
        throw new ValidationError('Invalid wallet address');
      }

      // Verify nonce hasn't been used and hasn't expired
      const storedNonce = await redisClient.get(`nonce:${address}`);
      if (!storedNonce || storedNonce !== nonce) {
        throw new AuthenticationError('Invalid or expired nonce');
      }

      // Verify signature
      const message = `Login to Inventory System: ${nonce}`;
      const recoveredAddress = verifyMessageSignature(message, signature);
      
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new AuthenticationError('Invalid signature');
      }

      // Check if user exists
      let user = await getUserByAddress(address);
      if (!user) {
        throw new AuthenticationError('User not found. Please register first.');
      }

      if (user.status !== 'Active') {
        throw new AuthenticationError('User account is not active');
      }

      // Verify role on blockchain
      const hasValidRole = await verifySignatureOnChain(address, user.role);
      if (!hasValidRole) {
        throw new AuthenticationError('Blockchain role verification failed');
      }

      // Consume nonce
      await consumeNonce(address, nonce);

      // Create session
      const sessionId = crypto.randomUUID();
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      await updateUserSession(sessionId, {
        userAddress: address,
        loginTime: Date.now(),
        expiryTime,
        isActive: true
      });

      // Generate tokens
      const accessToken = this.generateAccessToken(user, sessionId);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token
      await redisClient.setex(
        `refresh_token:${address}`,
        7 * 24 * 60 * 60, // 7 days
        refreshToken
      );

      logger.info('User logged in', { 
        address, 
        role: user.role,
        sessionId 
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            address: user.walletAddress,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes
            tokenType: 'Bearer'
          },
          sessionId
        }
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Register new user (admin only)
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { address, email, fullName, role, adminSignature } = req.body;

      // Verify admin signature
      const adminMessage = `Register user: ${address} as ${role}`;
      const adminAddress = verifyMessageSignature(adminMessage, adminSignature);

      // Check if admin has ADMIN role
      const admin = await getUserByAddress(adminAddress);
      if (!admin || admin.role !== 'ADMIN') {
        throw new AuthenticationError('Only admins can register users');
      }

      // Check if user already exists
      const existingUser = await getUserByAddress(address);
      if (existingUser) {
        throw new ConflictError('User already exists');
      }

      // Create user on blockchain
      const blockchainUser = await createUser({
        walletAddress: address,
        email,
        fullName,
        role
      }, adminAddress);

      // Store user in database
      const user = await createUser({
        id: blockchainUser.id,
        walletAddress: address,
        email,
        fullName,
        role: role as string,
        status: 'Active'
      });

      logger.info('User registered', { 
        address, 
        email, 
        role,
        registeredBy: adminAddress 
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            address: user.walletAddress,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            status: user.status
          }
        }
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout user
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = this.extractToken(req);
      if (!token) {
        res.json({ success: true, message: 'Already logged out' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      if (decoded.sessionId) {
        // Deactivate session
        await updateUserSession(decoded.sessionId, { isActive: false });
      }

      // Remove refresh token
      await redisClient.del(`refresh_token:${decoded.address}`);

      logger.info('User logged out', { address: decoded.address });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      // Even if token is invalid, return success
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  };

  /**
   * Refresh access token
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AuthenticationError('Refresh token is required');
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      
      // Check if refresh token is still valid
      const storedToken = await redisClient.get(`refresh_token:${decoded.address}`);
      if (storedToken !== refreshToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Get user
      const user = await getUserByAddress(decoded.address);
      if (!user || user.status !== 'Active') {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user, decoded.sessionId);

      logger.info('Token refreshed', { address: decoded.address });

      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn: 15 * 60, // 15 minutes
          tokenType: 'Bearer'
        }
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Get current user profile
   */
  public getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const user = await getUserByAddress(req.user.address);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            address: user.walletAddress,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          }
        }
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify message signature
   */
  public verifySignature = async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, signature, address } = req.body;

      if (!message || !signature || !address) {
        throw new ValidationError('Message, signature, and address are required');
      }

      const recoveredAddress = verifyMessageSignature(message, signature);
      const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();

      res.json({
        success: true,
        data: {
          isValid,
          recoveredAddress: isValid ? recoveredAddress : null
        }
      });
    } catch (error) {
      throw error;
    }
  };

  private generateAccessToken(user: any, sessionId: string): string {
    return jwt.sign(
      {
        id: user.id,
        address: user.walletAddress,
        email: user.email,
        role: user.role,
        sessionId
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      {
        id: user.id,
        address: user.walletAddress,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}

export const authController = new AuthController();