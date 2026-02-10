import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export interface AIAgentConfig {
  api: {
    url: string;
    healthEndpoint: string;
    timeout: number;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
  blockchain: {
    rpcUrl: string;
    network: string;
  };
  monitoring: {
    enabled: boolean;
    intervals: {
      system: number;
      blockchain: number;
      inventory: number;
      performance: number;
    };
    thresholds: {
      errorRate: number;
      responseTime: number;
      blockchainDelay: number;
      inventoryDiscrepancy: number;
    };
  };
}

const config: AIAgentConfig = {
  api: {
    url: process.env.API_URL || 'http://localhost:3001',
    healthEndpoint: process.env.API_HEALTH_ENDPOINT || '/health',
    timeout: parseInt(process.env.API_TIMEOUT || '5000', 10),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'inventory_db',
    user: process.env.DB_USER || 'inventory_user',
    password: process.env.DB_PASSWORD || '',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
    network: process.env.BLOCKCHAIN_NETWORK || 'hardhat',
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    intervals: {
      system: parseInt(process.env.MONITORING_SYSTEM_INTERVAL || '30', 10),
      blockchain: parseInt(process.env.MONITORING_BLOCKCHAIN_INTERVAL || '60', 10),
      inventory: parseInt(process.env.MONITORING_INVENTORY_INTERVAL || '300', 10),
      performance: parseInt(process.env.MONITORING_PERFORMANCE_INTERVAL || '60', 10),
    },
    thresholds: {
      errorRate: parseFloat(process.env.MONITORING_ERROR_RATE_THRESHOLD || '0.05'),
      responseTime: parseInt(process.env.MONITORING_RESPONSE_TIME_THRESHOLD || '2000', 10),
      blockchainDelay: parseInt(process.env.MONITORING_BLOCKCHAIN_DELAY_THRESHOLD || '300', 10),
      inventoryDiscrepancy: parseFloat(process.env.MONITORING_INVENTORY_DISCREPANCY_THRESHOLD || '0.01'),
    },
  },
};

export default config;
