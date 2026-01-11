import { pool } from '@/config/database';
import { logger } from '@/utils/logger';

export interface User {
    id: string;
    walletAddress: string;
    email?: string;
    fullName?: string;
    role: string;
    status: string;
    createdAt?: Date;
    lastLogin?: Date;
}

export const getUserByAddress = async (address: string): Promise<User | null> => {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE wallet_address = $1',
            [address.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            walletAddress: row.wallet_address,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            status: row.status,
            createdAt: row.created_at,
            lastLogin: row.last_login
        };
    } catch (error) {
        logger.error('Error getting user by address:', error);
        throw error;
    }
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    try {
        const { walletAddress, email, fullName, role, status = 'Active' } = userData;

        const queryText = `
      INSERT INTO users (wallet_address, email, full_name, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

        const values = [
            walletAddress?.toLowerCase(),
            email,
            fullName,
            role,
            status
        ];

        const result = await pool.query(queryText, values);
        const row = result.rows[0];

        return {
            id: row.id,
            walletAddress: row.wallet_address,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            status: row.status,
            createdAt: row.created_at
        };
    } catch (error) {
        logger.error('Error creating user:', error);
        throw error;
    }
};

export const updateUserSession = async (sessionId: string, sessionData: any): Promise<void> => {
    try {
        if (sessionData.loginTime) {
            await pool.query(
                'UPDATE users SET last_login = NOW() WHERE wallet_address = $1',
                [sessionData.userAddress.toLowerCase()]
            );
        }
        // Session tracking logic omitted for brevity
    } catch (error) {
        logger.error('Error updating user session:', error);
    }
};

export const getAllUsers = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const result = await pool.query(
        'SELECT id, wallet_address, full_name, role, status, created_at, last_login FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );

    const countRes = await pool.query('SELECT COUNT(*) FROM users');

    return {
        users: result.rows.map(row => ({
            id: row.id,
            walletAddress: row.wallet_address,
            fullName: row.full_name,
            role: row.role,
            status: row.status,
            createdAt: row.created_at,
            lastLogin: row.last_login
        })),
        total: parseInt(countRes.rows[0].count),
        page,
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
    };
};
