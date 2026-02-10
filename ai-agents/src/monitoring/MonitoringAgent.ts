import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { databaseService } from '@/services/databaseService';
import { blockchainService } from '@/services/blockchainService';
import { alertService } from '@/services/alertService';
import { MetricCollector } from '@/utils/metricCollector';
import { AnomalyDetector } from '@/utils/anomalyDetector';
import { CircuitBreaker } from '@/utils/circuitBreaker';

export interface MonitoringConfig {
  intervals: {
    system: number; // in seconds
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
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
  components: {
    database: ComponentHealth;
    blockchain: ComponentHealth;
    api: ComponentHealth;
    redis: ComponentHealth;
  };
  metrics: {
    errorRate: number;
    averageResponseTime: number;
    activeUsers: number;
    pendingTransactions: number;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: Date;
  errorMessage?: string;
}

export interface Anomaly {
  id: string;
  type: 'performance' | 'security' | 'inventory' | 'blockchain';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  metrics: any;
  detectedBy: string;
}

export class MonitoringAgent {
  private config: MonitoringConfig;
  private metricCollector: MetricCollector;
  private anomalyDetector: AnomalyDetector;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private isRunning: boolean = false;
  private intervals: NodeJS.Timeout[] = [];

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.metricCollector = new MetricCollector();
    this.anomalyDetector = new AnomalyDetector();
    this.circuitBreakers = new Map();
  }

  /**
   * Start the monitoring agent
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitoring agent is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting monitoring agent...');

    try {
      // Initialize monitoring intervals
      this.startSystemMonitoring();
      this.startBlockchainMonitoring();
      this.startInventoryMonitoring();
      this.startPerformanceMonitoring();

      logger.info('Monitoring agent started successfully');
    } catch (error) {
      logger.error('Failed to start monitoring agent:', error);
      throw error;
    }
  }

  /**
   * Stop the monitoring agent
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Monitoring agent is not running');
      return;
    }

    this.isRunning = false;
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    logger.info('Monitoring agent stopped');
  }

  /**
   * Get current system health status
   */
  public async getHealthStatus(): Promise<HealthStatus> {
    const components = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkBlockchainHealth(),
      this.checkAPIHealth(),
      this.checkRedisHealth()
    ]);

    const [database, blockchain, api, redis] = components;

    const overallStatus = this.determineOverallStatus([database, blockchain, api, redis]);

    const metrics = await this.collectSystemMetrics();

    return {
      status: overallStatus,
      timestamp: new Date(),
      components: {
        database,
        blockchain,
        api,
        redis
      },
      metrics
    };
  }

  /**
   * Detect anomalies in system behavior
   */
  public async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      // Collect metrics
      const metrics = await this.collectAllMetrics();
      
      // Run anomaly detection
      const performanceAnomalies = await this.anomalyDetector.detectPerformanceAnomalies(metrics.performance);
      const inventoryAnomalies = await this.anomalyDetector.detectInventoryAnomalies(metrics.inventory);
      const blockchainAnomalies = await this.anomalyDetector.detectBlockchainAnomalies(metrics.blockchain);
      const securityAnomalies = await this.anomalyDetector.detectSecurityAnomalies(metrics.security);

      anomalies.push(...performanceAnomalies, ...inventoryAnomalies, ...blockchainAnomalies, ...securityAnomalies);

      // Process detected anomalies
      for (const anomaly of anomalies) {
        await this.handleAnomaly(anomaly);
      }

    } catch (error) {
      logger.error('Error detecting anomalies:', error);
    }

    return anomalies;
  }

  private startSystemMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.performSystemHealthCheck();
      } catch (error) {
        logger.error('System health check failed:', error);
      }
    }, this.config.intervals.system * 1000);

    this.intervals.push(interval);
  }

  private startBlockchainMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.performBlockchainHealthCheck();
      } catch (error) {
        logger.error('Blockchain health check failed:', error);
      }
    }, this.config.intervals.blockchain * 1000);

    this.intervals.push(interval);
  }

  private startInventoryMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.performInventoryHealthCheck();
      } catch (error) {
        logger.error('Inventory health check failed:', error);
      }
    }, this.config.intervals.inventory * 1000);

    this.intervals.push(interval);
  }

  private startPerformanceMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.performPerformanceHealthCheck();
      } catch (error) {
        logger.error('Performance health check failed:', error);
      }
    }, this.config.intervals.performance * 1000);

    this.intervals.push(interval);
  }

  private async performSystemHealthCheck(): Promise<void> {
    const health = await this.getHealthStatus();
    
    logger.debug('System health check', { 
      status: health.status,
      components: Object.values(health.components).map(c => c.status)
    });

    // Check for critical issues
    const criticalComponents = Object.values(health.components).filter(
      component => component.status === 'down'
    );

    if (criticalComponents.length > 0) {
      await alertService.sendCriticalAlert(
        'System critical components down',
        {
          components: criticalComponents,
          health
        }
      );
    }
  }

  private async performBlockchainHealthCheck(): Promise<void> {
    try {
      const health = await blockchainService.getHealthStatus();
      
      if (health.blockDelay > this.config.thresholds.blockchainDelay) {
        await alertService.sendWarning(
          'Blockchain delay detected',
          {
            blockDelay: health.blockDelay,
            threshold: this.config.thresholds.blockchainDelay
          }
        );
      }

      if (health.pendingTransactions > 100) {
        await alertService.sendWarning(
          'High transaction queue',
          {
            pendingTransactions: health.pendingTransactions
          }
        );
      }

    } catch (error) {
      logger.error('Blockchain health check error:', error);
      await alertService.sendCriticalAlert('Blockchain health check failed', { error });
    }
  }

  private async performInventoryHealthCheck(): Promise<void> {
    try {
      const discrepancies = await databaseService.checkInventoryDiscrepancies();
      
      if (discrepancies.length > 0) {
        await alertService.sendWarning(
          'Inventory discrepancies detected',
          {
            discrepancies,
            count: discrepancies.length
          }
        );
      }

    } catch (error) {
      logger.error('Inventory health check error:', error);
    }
  }

  private async performPerformanceHealthCheck(): Promise<void> {
    try {
      const metrics = await this.collectSystemMetrics();
      
      if (metrics.errorRate > this.config.thresholds.errorRate) {
        await alertService.sendWarning(
          'High error rate detected',
          {
            errorRate: metrics.errorRate,
            threshold: this.config.thresholds.errorRate
          }
        );
      }

      if (metrics.averageResponseTime > this.config.thresholds.responseTime) {
        await alertService.sendWarning(
          'High response time detected',
          {
            responseTime: metrics.averageResponseTime,
            threshold: this.config.thresholds.responseTime
          }
        );
      }

    } catch (error) {
      logger.error('Performance health check error:', error);
    }
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      await databaseService.healthCheck();
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkBlockchainHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const blockNumber = await blockchainService.getLatestBlockNumber();
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 5000 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkAPIHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Simple health check - would hit actual API endpoint
      await fetch('http://localhost:3001/health');
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 2000 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // This would use actual Redis client
      // await redisClient.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 500 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private determineOverallStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'critical' {
    const downCount = components.filter(c => c.status === 'down').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;

    if (downCount > 0) {
      return downCount >= components.length / 2 ? 'critical' : 'degraded';
    }

    return degradedCount > 0 ? 'degraded' : 'healthy';
  }

  private async collectSystemMetrics(): Promise<any> {
    const [errorRate, responseTime, activeUsers, pendingTransactions] = await Promise.all([
      this.metricCollector.getErrorRate(),
      this.metricCollector.getAverageResponseTime(),
      this.metricCollector.getActiveUsers(),
      this.metricCollector.getPendingTransactions()
    ]);

    return {
      errorRate,
      averageResponseTime: responseTime,
      activeUsers,
      pendingTransactions
    };
  }

  private async collectAllMetrics(): Promise<any> {
    return {
      performance: await this.metricCollector.getPerformanceMetrics(),
      inventory: await this.metricCollector.getInventoryMetrics(),
      blockchain: await this.metricCollector.getBlockchainMetrics(),
      security: await this.metricCollector.getSecurityMetrics()
    };
  }

  private async handleAnomaly(anomaly: Anomaly): Promise<void> {
    logger.warn('Anomaly detected', {
      id: anomaly.id,
      type: anomaly.type,
      severity: anomaly.severity,
      description: anomaly.description
    });

    // Send alerts based on severity
    switch (anomaly.severity) {
      case 'critical':
        await alertService.sendCriticalAlert(anomaly.description, anomaly);
        break;
      case 'high':
        await alertService.sendWarning(anomaly.description, anomaly);
        break;
      case 'medium':
      case 'low':
        await alertService.sendInfo(anomaly.description, anomaly);
        break;
    }

    // Store anomaly for analysis
    await this.storeAnomaly(anomaly);
  }

  private async storeAnomaly(anomaly: Anomaly): Promise<void> {
    try {
      await databaseService.storeAnomaly({
        id: anomaly.id,
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
        timestamp: anomaly.timestamp,
        metrics: anomaly.metrics,
        detectedBy: anomaly.detectedBy
      });
    } catch (error) {
      logger.error('Failed to store anomaly:', error);
    }
  }
}