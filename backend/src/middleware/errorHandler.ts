import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { StatusCodes } from 'http-status-codes';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string | number;
  path?: string;
  value?: any;
  errors?: any;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string | number;

  constructor(message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  public errors: any;

  constructor(message: string, errors: any = []) {
    super(message, StatusCodes.BAD_REQUEST);
    this.errors = errors;
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, StatusCodes.FORBIDDEN);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, StatusCodes.NOT_FOUND);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource conflict') {
    super(message, StatusCodes.CONFLICT);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, StatusCodes.TOO_MANY_REQUESTS);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = 500, message } = error;

  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    statusCode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Mongoose bad ObjectId
  if (error.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid resource ID';
  }

  // Mongoose duplicate key
  if (error.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    message = 'Duplicate resource';
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    const errors = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message
    }));
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Token expired';
  }

  // Blockchain errors
  if (error.message && error.message.includes('revert')) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Transaction reverted: ' + error.message;
  }

  // Don't leak error details in production for non-operational errors
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    message = 'Internal server error';
  }

  const errorResponse: any = {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add validation errors if they exist
  if (error instanceof ValidationError && error.errors.length > 0) {
    errorResponse.errors = error.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Add request ID if it exists
  const requestId = req.headers['x-request-id'];
  if (requestId) {
    errorResponse.requestId = requestId;
  }

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: error.message,
    statusCode: StatusCodes.NOT_FOUND,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Specific error handlers for different types of errors
export const handleDatabaseError = (error: any): never => {
  logger.error('Database error:', error);
  
  if (error.code === 'ECONNREFUSED') {
    throw new CustomError('Database connection failed', StatusCodes.SERVICE_UNAVAILABLE);
  }
  
  if (error.code === 'ETIMEDOUT') {
    throw new CustomError('Database timeout', StatusCodes.SERVICE_UNAVAILABLE);
  }
  
  if (error.code === '23505') { // PostgreSQL unique violation
    throw new ConflictError('Resource already exists');
  }
  
  throw new CustomError('Database operation failed', StatusCodes.INTERNAL_SERVER_ERROR);
};

export const handleBlockchainError = (error: any): never => {
  logger.error('Blockchain error:', error);
  
  if (error.code === 'INSUFFICIENT_FUNDS') {
    throw new CustomError('Insufficient funds for transaction', StatusCodes.BAD_REQUEST);
  }
  
  if (error.code === 'NETWORK_ERROR') {
    throw new CustomError('Blockchain network unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }
  
  if (error.message && error.message.includes('gas')) {
    throw new CustomError('Gas estimation failed', StatusCodes.BAD_REQUEST);
  }
  
  throw new CustomError('Blockchain operation failed', StatusCodes.INTERNAL_SERVER_ERROR);
};

export const handleRedisError = (error: any): never => {
  logger.error('Redis error:', error);
  
  if (error.code === 'ECONNREFUSED') {
    throw new CustomError('Cache service unavailable', StatusCodes.SERVICE_UNAVAILABLE);
  }
  
  throw new CustomError('Cache operation failed', StatusCodes.INTERNAL_SERVER_ERROR);
};