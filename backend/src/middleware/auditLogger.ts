import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { logAuditEvent } from '@/services/auditService';
import { AuthenticatedRequest } from '@/middleware/auth';

export const auditLogger = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to capture response data
  res.json = function(data: any) {
    // Only log successful operations (status 2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Log audit event asynchronously (don't block response)
      logAuditEventAsync(req, res, data).catch(error => {
        logger.error('Failed to log audit event:', error);
      });
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

async function logAuditEventAsync(
  req: AuthenticatedRequest,
  res: Response,
  responseData: any
): Promise<void> {
  try {
    if (!req.user) {
      return; // Skip logging if no authenticated user
    }

    const eventType = determineEventType(req);
    const severity = determineSeverity(req, res);
    const action = extractAction(req);
    const resource = extractResource(req);
    const details = extractDetails(req, responseData);

    await logAuditEvent({
      eventType,
      severity,
      actor: req.user.address,
      action,
      resource,
      details,
      dataHash: generateDataHash(responseData),
      requestContext: {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Audit logging failed:', error);
  }
}

function determineEventType(req: Request): string {
  const path = req.path;
  
  if (path.includes('/inventory')) {
    return 'INVENTORY_OPERATION';
  } else if (path.includes('/users')) {
    return 'USER_ACTION';
  } else if (path.includes('/admin')) {
    return 'CONFIGURATION_CHANGE';
  } else if (path.includes('/audit')) {
    return 'DATA_ACCESS';
  } else if (path.includes('/auth')) {
    return 'USER_ACTION';
  }
  
  return 'SYSTEM_EVENT';
}

function determineSeverity(req: Request, res: Response): string {
  const method = req.method;
  const path = req.path;
  
  // High severity for destructive operations
  if (method === 'DELETE' || path.includes('/delete')) {
    return 'HIGH';
  }
  
  // Medium severity for modifications
  if (method === 'PUT' || method === 'PATCH') {
    return 'MEDIUM';
  }
  
  // Low severity for reads and authentication
  return 'LOW';
}

function extractAction(req: Request): string {
  const method = req.method;
  const path = req.path;
  
  if (method === 'GET') {
    return 'READ';
  } else if (method === 'POST') {
    return 'CREATE';
  } else if (method === 'PUT' || method === 'PATCH') {
    return 'UPDATE';
  } else if (method === 'DELETE') {
    return 'DELETE';
  }
  
  return 'UNKNOWN';
}

function extractResource(req: Request): string {
  const path = req.path;
  const segments = path.split('/');
  
  if (segments.length >= 3) {
    return segments[2].toUpperCase();
  }
  
  return 'UNKNOWN';
}

function extractDetails(req: Request, responseData: any): string {
  const details: any = {
    method: req.method,
    path: req.path,
    statusCode: responseData?.success ? 'SUCCESS' : 'ERROR'
  };
  
  // Add specific details based on resource type
  if (req.path.includes('/inventory')) {
    if (req.params.id) {
      details.itemId = req.params.id;
    }
    if (req.body?.quantity) {
      details.quantity = req.body.quantity;
    }
  }
  
  if (req.path.includes('/users')) {
    if (req.params.id) {
      details.targetUserId = req.params.id;
    }
    if (req.body?.role) {
      details.roleChange = req.body.role;
    }
  }
  
  return JSON.stringify(details);
}

function generateDataHash(data: any): string {
  if (!data) return '';
  
  try {
    const crypto = require('crypto');
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  } catch (error) {
    logger.warn('Failed to generate data hash:', error);
    return '';
  }
}

export const securityAuditLogger = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Store original res.status method to capture status codes
  const originalStatus = res.status;
  
  res.status = function(code: number) {
    // Log security events for specific status codes
    if (code === 401 || code === 403 || code === 429) {
      logSecurityEventAsync(req, code).catch(error => {
        logger.error('Failed to log security event:', error);
      });
    }
    
    return originalStatus.call(this, code);
  };
  
  next();
};

async function logSecurityEventAsync(
  req: AuthenticatedRequest,
  statusCode: number
): Promise<void> {
  try {
    const eventType = 'SECURITY_EVENT';
    const severity = statusCode === 429 ? 'MEDIUM' : 'HIGH';
    
    let action = 'UNAUTHORIZED_ACCESS';
    if (statusCode === 403) {
      action = 'FORBIDDEN_ACCESS';
    } else if (statusCode === 429) {
      action = 'RATE_LIMIT_EXCEEDED';
    }
    
    const details = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode,
      userAddress: req.user?.address || 'anonymous',
      timestamp: new Date().toISOString()
    };
    
    await logAuditEvent({
      eventType,
      severity,
      actor: req.user?.address || '0x0000000000000000000000000000000000000000',
      action,
      resource: extractResource(req),
      details: JSON.stringify(details),
      dataHash: '',
      requestContext: {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      }
    });
    
    logger.warn('Security event logged', details);
    
  } catch (error) {
    logger.error('Security audit logging failed:', error);
  }
}