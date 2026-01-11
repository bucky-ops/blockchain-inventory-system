import { Request, Response } from 'express';
import { pool } from '@/config/database';

export class AdminController {
    public getSystemStats = async (req: Request, res: Response): Promise<void> => {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const itemsCount = await pool.query('SELECT COUNT(*) FROM inventory_items');
        const ordersCount = await pool.query('SELECT COUNT(*) FROM orders'); // Assuming orders table exists

        res.json({
            success: true,
            data: {
                users: parseInt(usersCount.rows[0].count),
                items: parseInt(itemsCount.rows[0].count),
                orders: 0 // Placeholder
            }
        });
    };
}

export const adminController = new AdminController();
