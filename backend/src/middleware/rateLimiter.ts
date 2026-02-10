import rateLimit from 'express-rate-limit';
import config from 'config';

const rateLimitConfig = config.get<any>('rateLimit');

export const rateLimiter = {
    // General API rate limiter
    api: rateLimit({
        windowMs: rateLimitConfig.windowMs,
        max: rateLimitConfig.maxRequests,
        message: {
            success: false,
            message: 'Too many requests, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
    }),

    // Auth specific rate limiter (stricter)
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // Limit each IP to 20 login/register requests per windowMs
        message: {
            success: false,
            message: 'Too many authentication attempts, please try again later.'
        }
    }),

    // Nonce generation limiter
    nonce: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 10, // Limit of 10 nonce requests per minute
        message: {
            success: false,
            message: 'Too many nonce requests, please try again later.'
        }
    })
};
