import { pool } from '@/config/database';
import { logger } from '@/utils/logger';

export interface Session {
  id: string;
  userId: string;
  userAddress: string;
  loginTime: Date;
  expiryTime: Date;
  lastActivity: Date;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export const getUserSession = async (sessionId: string): Promise<Session | null> => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.wallet_address as user_address 
       FROM user_sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      userAddress: row.user_address,
      loginTime: row.created_at,
      expiryTime: row.expires_at,
      lastActivity: row.last_accessed,
      isActive: row.is_active,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  } catch (error) {
    logger.error('Error getting user session:', error);
    throw error;
  }
};

export const createSession = async (
  userId: string,
  userAddress: string,
  sessionToken: string,
  expiresAt: Date,
  ipAddress?: string,
  userAgent?: string
): Promise<string> => {
  try {
    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, session_token, wallet_address, expires_at, is_active, ip_address, user_agent, created_at, last_accessed)
       VALUES ($1, $2, $3, $4, true, $5, $6, NOW(), NOW())
       RETURNING id`,
      [userId, sessionToken, userAddress.toLowerCase(), expiresAt, ipAddress, userAgent]
    );

    return result.rows[0].id;
  } catch (error) {
    logger.error('Error creating session:', error);
    throw error;
  }
};

export const updateSession = async (sessionId: string, updates: Partial<Session>): Promise<void> => {
  try {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (updates.lastActivity !== undefined) {
      setClause.push(`last_accessed = $${paramIndex++}`);
      values.push(updates.lastActivity);
    }

    if (setClause.length === 0) {
      return;
    }

    values.push(sessionId);
    await pool.query(
      `UPDATE user_sessions SET ${setClause.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  } catch (error) {
    logger.error('Error updating session:', error);
    throw error;
  }
};

export const invalidateSession = async (sessionId: string): Promise<void> => {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_active = false WHERE id = $1',
      [sessionId]
    );
  } catch (error) {
    logger.error('Error invalidating session:', error);
    throw error;
  }
};

export const invalidateAllUserSessions = async (userId: string): Promise<void> => {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
      [userId]
    );
  } catch (error) {
    logger.error('Error invalidating all user sessions:', error);
    throw error;
  }
};

export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    const result = await pool.query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE is_active = true AND expires_at < NOW()`
    );

    return result.rowCount || 0;
  } catch (error) {
    logger.error('Error cleaning up expired sessions:', error);
    throw error;
  }
};
