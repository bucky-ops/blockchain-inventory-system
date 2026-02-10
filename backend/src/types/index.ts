// Logger type definitions for winston
export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// JWT Payload interface
export interface JWTPayload {
  id: number;
  address: string;
  email: string;
  role: string;
  sessionId: string;
}

// Custom error interface
export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Request interface for authenticated requests
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