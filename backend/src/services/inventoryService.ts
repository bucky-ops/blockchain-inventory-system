import { pool } from '@/config/database';
import { logger } from '@/utils/logger';

export interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    location: string;
    threshold: number;
    status: 'Active' | 'Inactive' | 'Discontinued';
    createdAt: Date;
    updatedAt: Date;
}

export const getInventoryItems = async (
    page = 1,
    limit = 10,
    search?: string
) => {
    const offset = (page - 1) * limit;
    let queryText = 'SELECT * FROM inventory_items';
    const queryParams: any[] = [limit, offset];
    let paramIndex = 3;

    if (search) {
        queryText += ` WHERE name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex}`;
        queryParams.push(`%${search}%`);
    }

    queryText += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';

    const result = await pool.query(queryText, queryParams);
    const countRes = await pool.query('SELECT COUNT(*) FROM inventory_items');

    return {
        items: result.rows,
        total: parseInt(countRes.rows[0].count),
        page,
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
    };
};

export const getInventoryItemById = async (id: string): Promise<InventoryItem | null> => {
    const result = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [id]);
    return result.rows[0] || null;
};

export const createInventoryItem = async (itemData: any): Promise<InventoryItem> => {
    const { sku, name, category, quantity, location, threshold } = itemData;

    const result = await pool.query(
        `INSERT INTO inventory_items (sku, name, category, quantity, location, threshold, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
        [sku, name, category, quantity, location, threshold]
    );

    return result.rows[0];
};

export const updateInventoryItem = async (id: string, itemData: any): Promise<InventoryItem | null> => {
    const { name, category, quantity, location, threshold } = itemData;

    const result = await pool.query(
        `UPDATE inventory_items 
     SET name = $1, category = $2, quantity = $3, location = $4, threshold = $5, updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
        [name, category, quantity, location, threshold, id]
    );

    return result.rows[0] || null;
};

export const deleteInventoryItem = async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM inventory_items WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
};
