import { pool } from '@/config/database';
import { logger } from '@/utils/logger';

class DatabaseService {
    /**
     * Check database health
     */
    public async healthCheck(): Promise<boolean> {
        try {
            await pool.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('Database health check failed:', error);
            throw error;
        }
    }

    /**
     * Check for inventory discrepancies
     * (Placeholder logic comparing DB vs Blockchain if implemented)
     */
    public async checkInventoryDiscrepancies(): Promise<any[]> {
        return [];
    }

    /**
     * Store anomaly detected by AI agents
     */
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
                    anomaly.detectedBy
                ]
            );
        } catch (error) {
            logger.error('Error storing anomaly:', error);
        }
    }
}

export const databaseService = new DatabaseService();
