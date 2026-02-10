import crypto from 'crypto';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

const NONCE_EXPIRY = 60 * 15; // 15 minutes in seconds

/**
 * Generate a cryptographically secure random nonce
 */
export const createNonce = (address: string): string => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Store nonce in Redis with expiration
 */
export const storeNonce = async (address: string, nonce: string): Promise<void> => {
    try {
        const key = `nonce:${address.toLowerCase()}`;
        await redisClient.setEx(key, NONCE_EXPIRY, nonce);
    } catch (error) {
        logger.error('Error storing nonce:', error);
        throw new Error('Failed to generate authentication challenge');
    }
};

/**
 * Verify and consume (delete) nonce
 */
export const consumeNonce = async (address: string, nonce: string): Promise<boolean> => {
    try {
        const key = `nonce:${address.toLowerCase()}`;
        const storedNonce = await redisClient.get(key);

        if (!storedNonce) {
            return false;
        }

        if (storedNonce !== nonce) {
            return false;
        }

        // Delete nonce after successful use to prevent replay attacks
        await redisClient.del(key);
        return true;
    } catch (error) {
        logger.error('Error consuming nonce:', error);
        return false;
    }
};
