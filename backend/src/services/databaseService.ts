import { pool } from "@/config/database";
import { logger } from "@/utils/logger";

interface User {
  id: string;
  wallet_address: string;
  email?: string;
  username: string;
  role: "admin" | "manager" | "user" | "viewer";
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit_price?: number;
  supplier?: string;
  location?: string;
  status: "active" | "inactive" | "discontinued" | "out_of_stock";
  owner_id?: string;
  blockchain_tx_hash?: string;
  blockchain_timestamp?: Date;
  created_at: Date;
  updated_at: Date;
}

interface InventoryMovement {
  id: string;
  item_id: string;
  movement_type: "in" | "out" | "adjustment" | "transfer";
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference_number?: string;
  performed_by?: string;
  blockchain_tx_hash?: string;
  blockchain_timestamp?: Date;
  created_at: Date;
}

interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  blockchain_tx_hash?: string;
  blockchain_timestamp?: Date;
  created_at: Date;
}

interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  wallet_address: string;
  expires_at: Date;
  is_active: boolean;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  last_accessed: Date;
}

class DatabaseService {
  // Health and System Operations
  public async healthCheck(): Promise<boolean> {
    try {
      await pool.query("SELECT 1");
      return true;
    } catch (error) {
      logger.error("Database health check failed:", error);
      throw error;
    }
  }

  public async checkInventoryDiscrepancies(): Promise<any[]> {
    try {
      const result = await pool.query(`
                SELECT i.id, i.sku, i.name, i.quantity as db_quantity,
                       COALESCE(SUM(m.quantity), 0) as movement_total
                FROM inventory_items i
                LEFT JOIN inventory_movements m ON i.id = m.item_id
                GROUP BY i.id, i.sku, i.name, i.quantity
                HAVING i.quantity != COALESCE(SUM(m.quantity), 0)
            `);
      return result.rows;
    } catch (error) {
      logger.error("Error checking inventory discrepancies:", error);
      return [];
    }
  }

  public async storeAnomaly(anomaly: any): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO system_anomalies (
                    id, type, severity, description, timestamp, metrics, detected_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          anomaly.id,
          anomaly.type,
          anomaly.severity,
          anomaly.description,
          anomaly.timestamp,
          JSON.stringify(anomaly.metrics),
          anomaly.detectedBy,
        ],
      );
    } catch (error) {
      logger.error("Error storing anomaly:", error);
    }
  }

  // User Operations
  public async createUser(userData: Partial<User>): Promise<User> {
    try {
      const query = `
                INSERT INTO users (wallet_address, email, username, role, is_active)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
      const result = await pool.query(query, [
        userData.wallet_address,
        userData.email,
        userData.username,
        userData.role || "user",
        userData.is_active !== false,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [
        userId,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error getting user by ID:", error);
      throw error;
    }
  }

  public async getUserByWalletAddress(
    walletAddress: string,
  ): Promise<User | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE wallet_address = $1",
        [walletAddress],
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error getting user by wallet address:", error);
      throw error;
    }
  }

  public async updateUser(
    userId: string,
    updates: Partial<User>,
  ): Promise<User> {
    try {
      const fields = Object.keys(updates).filter((key) => key !== "id");
      const values = fields.map((field) => updates[field as keyof User]);
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");

      const query = `
                UPDATE users 
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;
      const result = await pool.query(query, [userId, ...values]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating user:", error);
      throw error;
    }
  }

  public async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    try {
      const result = await pool.query(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [limit, offset],
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting all users:", error);
      throw error;
    }
  }

  // Inventory Operations
  public async createInventoryItem(
    itemData: Partial<InventoryItem>,
  ): Promise<InventoryItem> {
    try {
      const query = `
                INSERT INTO inventory_items (
                    sku, name, description, category, quantity, unit_price, 
                    supplier, location, status, owner_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
      const result = await pool.query(query, [
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.quantity || 0,
        itemData.unit_price,
        itemData.supplier,
        itemData.location,
        itemData.status || "active",
        itemData.owner_id,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating inventory item:", error);
      throw error;
    }
  }

  public async getInventoryItemById(
    itemId: string,
  ): Promise<InventoryItem | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM inventory_items WHERE id = $1",
        [itemId],
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error getting inventory item by ID:", error);
      throw error;
    }
  }

  public async getInventoryItemBySku(
    sku: string,
  ): Promise<InventoryItem | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM inventory_items WHERE sku = $1",
        [sku],
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error getting inventory item by SKU:", error);
      throw error;
    }
  }

  public async updateInventoryItem(
    itemId: string,
    updates: Partial<InventoryItem>,
  ): Promise<InventoryItem> {
    try {
      const fields = Object.keys(updates).filter((key) => key !== "id");
      const values = fields.map(
        (field) => updates[field as keyof InventoryItem],
      );
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");

      const query = `
                UPDATE inventory_items 
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;
      const result = await pool.query(query, [itemId, ...values]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating inventory item:", error);
      throw error;
    }
  }

  public async deleteInventoryItem(itemId: string): Promise<void> {
    try {
      await pool.query("DELETE FROM inventory_items WHERE id = $1", [itemId]);
    } catch (error) {
      logger.error("Error deleting inventory item:", error);
      throw error;
    }
  }

  public async getAllInventoryItems(
    limit = 50,
    offset = 0,
    filters?: any,
  ): Promise<InventoryItem[]> {
    try {
      let query = "SELECT * FROM inventory_items WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(filters.category);
      }
      if (filters?.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters?.owner_id) {
        query += ` AND owner_id = $${paramIndex++}`;
        params.push(filters.owner_id);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Error getting all inventory items:", error);
      throw error;
    }
  }

  // Inventory Movement Operations
  public async createInventoryMovement(
    movementData: Partial<InventoryMovement>,
  ): Promise<InventoryMovement> {
    try {
      const query = `
                INSERT INTO inventory_movements (
                    item_id, movement_type, quantity, previous_quantity, 
                    new_quantity, reason, reference_number, performed_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
      const result = await pool.query(query, [
        movementData.item_id,
        movementData.movement_type,
        movementData.quantity,
        movementData.previous_quantity,
        movementData.new_quantity,
        movementData.reason,
        movementData.reference_number,
        movementData.performed_by,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating inventory movement:", error);
      throw error;
    }
  }

  public async getInventoryMovementsByItemId(
    itemId: string,
    limit = 50,
  ): Promise<InventoryMovement[]> {
    try {
      const result = await pool.query(
        "SELECT * FROM inventory_movements WHERE item_id = $1 ORDER BY created_at DESC LIMIT $2",
        [itemId, limit],
      );
      return result.rows;
    } catch (error) {
      logger.error("Error getting inventory movements:", error);
      throw error;
    }
  }

  // Audit Log Operations
  public async createAuditLog(logData: Partial<AuditLog>): Promise<AuditLog> {
    try {
      const query = `
                INSERT INTO audit_logs (
                    user_id, action, resource_type, resource_id, 
                    old_values, new_values, ip_address, user_agent
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
      const result = await pool.query(query, [
        logData.user_id,
        logData.action,
        logData.resource_type,
        logData.resource_id,
        logData.old_values ? JSON.stringify(logData.old_values) : null,
        logData.new_values ? JSON.stringify(logData.new_values) : null,
        logData.ip_address,
        logData.user_agent,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating audit log:", error);
      throw error;
    }
  }

  public async getAuditLogs(
    limit = 100,
    offset = 0,
    filters?: any,
  ): Promise<AuditLog[]> {
    try {
      let query = "SELECT * FROM audit_logs WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.user_id) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(filters.user_id);
      }
      if (filters?.action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(filters.action);
      }
      if (filters?.resource_type) {
        query += ` AND resource_type = $${paramIndex++}`;
        params.push(filters.resource_type);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Error getting audit logs:", error);
      throw error;
    }
  }

  // Session Operations
  public async createSession(
    sessionData: Partial<UserSession>,
  ): Promise<UserSession> {
    try {
      const query = `
                INSERT INTO user_sessions (
                    user_id, session_token, wallet_address, expires_at, 
                    is_active, ip_address, user_agent
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
      const result = await pool.query(query, [
        sessionData.user_id,
        sessionData.session_token,
        sessionData.wallet_address,
        sessionData.expires_at,
        sessionData.is_active !== false,
        sessionData.ip_address,
        sessionData.user_agent,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating session:", error);
      throw error;
    }
  }

  public async getSessionByToken(token: string): Promise<UserSession | null> {
    try {
      const result = await pool.query(
        "SELECT * FROM user_sessions WHERE session_token = $1 AND is_active = true AND expires_at > NOW()",
        [token],
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error getting session by token:", error);
      throw error;
    }
  }

  public async updateSessionLastAccessed(sessionId: string): Promise<void> {
    try {
      await pool.query(
        "UPDATE user_sessions SET last_accessed = NOW() WHERE id = $1",
        [sessionId],
      );
    } catch (error) {
      logger.error("Error updating session last accessed:", error);
      throw error;
    }
  }

  public async invalidateSession(token: string): Promise<void> {
    try {
      await pool.query(
        "UPDATE user_sessions SET is_active = false WHERE session_token = $1",
        [token],
      );
    } catch (error) {
      logger.error("Error invalidating session:", error);
      throw error;
    }
  }

  public async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      await pool.query(
        "UPDATE user_sessions SET is_active = false WHERE user_id = $1",
        [userId],
      );
    } catch (error) {
      logger.error("Error invalidating all user sessions:", error);
      throw error;
    }
  }

  // Summary and Analytics Operations
  public async getInventorySummary(): Promise<any> {
    try {
      const result = await pool.query("SELECT * FROM inventory_summary");
      return result.rows;
    } catch (error) {
      logger.error("Error getting inventory summary:", error);
      throw error;
    }
  }

  public async getUserActivitySummary(): Promise<any> {
    try {
      const result = await pool.query("SELECT * FROM user_activity_summary");
      return result.rows;
    } catch (error) {
      logger.error("Error getting user activity summary:", error);
      throw error;
    }
  }

  public async getSystemConfig(key: string): Promise<string | null> {
    try {
      const result = await pool.query(
        "SELECT value FROM system_config WHERE key = $1",
        [key],
      );
      return result.rows[0]?.value || null;
    } catch (error) {
      logger.error("Error getting system config:", error);
      throw error;
    }
  }

  public async updateSystemConfig(
    key: string,
    value: string,
    updatedBy?: string,
  ): Promise<void> {
    try {
      await pool.query(
        "UPDATE system_config SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3",
        [value, updatedBy, key],
      );
    } catch (error) {
      logger.error("Error updating system config:", error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService();
