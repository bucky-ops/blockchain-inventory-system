import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { connectDatabase } from '@/config/database';
import { connectBlockchain } from '@/config/blockchain';
import { connectRedis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { authMiddleware } from '@/middleware/auth';
import { auditLogger } from '@/middleware/auditLogger';
import { requestLogger } from '@/middleware/requestLogger';

// Route imports
import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/users';
import inventoryRoutes from '@/routes/inventory';
import auditRoutes from '@/routes/audit';
import adminRoutes from '@/routes/admin';
import healthRoutes from '@/routes/health';

// Configuration
import config from 'config';

class App {
  public app: express.Application;
  public server: any;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = config.get<Array<string>>('cors.allowedOrigins');
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.get<number>('rateLimit.maxRequests'),
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Request logging
    this.app.use(requestLogger);

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check (no auth required)
    this.app.use('/health', healthRoutes);

    // API routes
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/users', authMiddleware, userRoutes);
    this.app.use('/api/v1/inventory', authMiddleware, auditLogger, inventoryRoutes);
    this.app.use('/api/v1/audit', authMiddleware, auditRoutes);
    this.app.use('/api/v1/admin', authMiddleware, adminRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async initialize(): Promise<void> {
    try {
      // Connect to external services
      await Promise.all([
        connectDatabase(),
        connectRedis(),
        connectBlockchain()
      ]);

      logger.info('All services connected successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    const port = config.get<number>('server.port');
    const host = config.get<string>('server.host');

    await this.initialize();

    this.server.listen(port, host, () => {
      logger.info(`🚀 Server running on ${host}:${port}`);
      logger.info(`📊 Environment: ${config.get<string>('env')}`);
      logger.info(`🔧 API Documentation: http://${host}:${port}/api/v1/docs`);
    });

    // Graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    this.server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      // await disconnectDatabase();
      // await disconnectRedis();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  }
}

// Start the application
const app = new App();
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default app;