import { Request, Response } from 'express';
import { databaseService } from '@/services/databaseService';
import { getHealthStatus } from '@/services/blockchainService';
import { redisClient } from '@/config/redis';

export class HealthController {
    public getHealth = async (req: Request, res: Response): Promise<void> => {
        try {
            const dbStart = Date.now();
            const dbStatus = await databaseService.healthCheck();
            const dbLatency = Date.now() - dbStart;

            const redisStart = Date.now();
            const redisStatus = redisClient.isOpen;
            const redisLatency = Date.now() - redisStart;

            const blockchainStatus = await getHealthStatus();

            res.status(200).json({
                success: true,
                status: 'UP',
                timestamp: new Date(),
                services: {
                    database: {
                        status: dbStatus ? 'UP' : 'DOWN',
                        latency: `${dbLatency}ms`
                    },
                    redis: {
                        status: redisStatus ? 'UP' : 'DOWN',
                        latency: `${redisLatency}ms`
                    },
                    blockchain: {
                        status: 'UP', // derived from getHealthStatus in real app
                        ...blockchainStatus
                    }
                }
            });
        } catch (error) {
            res.status(503).json({
                success: false,
                status: 'DOWN',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
}

export const healthController = new HealthController();
