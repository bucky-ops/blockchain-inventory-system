import { pool } from '@/config/database';

export const logAudit = async (
    userId: string | null,
    action: string,
    resource: string,
    details: any,
    ip: string
) => {
    await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource, details, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, action, resource, JSON.stringify(details), ip]
    );
};

export const getAuditLogs = async (page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const result = await pool.query(
        `SELECT a.*, u.email, u.wallet_address 
     FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     ORDER BY a.created_at DESC 
     LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const count = await pool.query('SELECT COUNT(*) FROM audit_logs');

    return {
        logs: result.rows,
        total: parseInt(count.rows[0].count),
        page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit)
    };
};
