import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { getUserByAddress, updateUserSession } from '@/services/userService';
import { hasRole } from '@/services/blockchainService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    address: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
  };
  sessionId?: string;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Validate user exists and is active
    const user = await getUserByAddress(decoded.address);
    
    if (!user || user.status !== 'Active') {
      res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
      return;
    }

    // Validate blockchain address
    if (!ethers.isAddress(decoded.address)) {
      res.status(401).json({
        success: false,
        message: 'Invalid blockchain address'
      });
      return;
    }

    // Verify session is still valid
    if (decoded.sessionId) {
      const sessionValid = await validateSession(decoded.sessionId, decoded.address);
      if (!sessionValid) {
        res.status(401).json({
          success: false,
          message: 'Session expired'
        });
        return;
      }
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      address: user.walletAddress,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status
    };
    
    req.sessionId = decoded.sessionId;

    // Log authentication event
    logger.info('User authenticated', {
      address: user.walletAddress,
      role: user.role,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const userRole = req.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        logger.warn('Access denied - insufficient permissions', {
          address: req.user.address,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method
        });

        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      // Verify role on blockchain for critical operations
      const blockchainRoleVerified = await hasRole(req.user.address, userRole);
      if (!blockchainRoleVerified) {
        logger.warn('Access denied - blockchain role mismatch', {
          address: req.user.address,
          userRole,
          path: req.path,
          method: req.method
        });

        res.status(403).json({
          success: false,
          message: 'Blockchain role verification failed'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Role verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

export const requireAdmin = requireRole(['ADMIN']);
export const requireManagerOrAbove = requireRole(['ADMIN', 'MANAGER']);
export const requireOperatorOrAbove = requireRole(['ADMIN', 'MANAGER', 'OPERATOR']);
export const requireAuditorOrAbove = requireRole(['ADMIN', 'MANAGER', 'AUDITOR']);

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Also check for token in query parameters (for file downloads, etc.)
  const queryToken = req.query.token as string;
  if (queryToken) {
    return queryToken;
  }
  
  return null;
}

async function validateSession(sessionId: string, userAddress: string): Promise<boolean> {
  try {
    // Check session in database
    const session = await getUserSession(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }

    if (session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return false;
    }

    // Check if session has expired
    if (session.expiryTime < Date.now()) {
      // Mark session as inactive
      await updateUserSession(sessionId, { isActive: false });
      return false;
    }

    // Update last activity
    await updateUserSession(sessionId, { lastActivity: Date.now() });
    
    return true;
  } catch (error) {
    logger.error('Session validation error:', error);
    return false;
  }
}

async function getUserSession(sessionId: string): Promise<any> {
  // This would typically query the database
  // Implementation depends on your database structure
  return null;
}

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      // If token exists, validate it and attach user info
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await getUserByAddress(decoded.address);
      
      if (user && user.status === 'Active') {
        req.user = {
          id: user.id,
          address: user.walletAddress,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status
        };
        req.sessionId = decoded.sessionId;
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't return errors, just continue without user
    next();
  }
};