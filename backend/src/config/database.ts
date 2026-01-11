import { Pool } from 'pg';
import config from 'config';
import { logger } from '@/utils/logger';

const dbConfig = config.get<any>('database');

export const pool = new Pool({
  host: process.env.DB_HOST || dbConfig.host,
  port: parseInt(process.env.DB_PORT || dbConfig.port.toString()),
  database: process.env.DB_NAME || dbConfig.name,
  user: process.env.DB_USER || dbConfig.user,
  password: process.env.DB_PASSWORD || dbConfig.password,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : dbConfig.ssl,
  max: parseInt(process.env.DB_CONNECTION_LIMIT || dbConfig.connectionLimit.toString()),
});

export const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL database');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text, error });
    throw error;
  }
};
