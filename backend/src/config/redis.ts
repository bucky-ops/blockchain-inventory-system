import { createClient } from 'redis';
import config from 'config';
import { logger } from '@/utils/logger';

const redisConfig = config.get<any>('redis');

export const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || redisConfig.host,
        port: parseInt(process.env.REDIS_PORT || redisConfig.port.toString()),
    },
    password: process.env.REDIS_PASSWORD || redisConfig.password,
    database: parseInt(process.env.REDIS_DB || redisConfig.db.toString())
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

export const connectRedis = async (): Promise<void> => {
    try {
        await redisClient.connect();
        logger.info('Successfully connected to Redis');
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
    }
};
