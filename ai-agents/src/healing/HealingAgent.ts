import { logger } from '@/utils/logger';
import { databaseService } from '@/services/databaseService';
import { blockchainService } from '@/services/blockchainService';
import { alertService } from '@/services/alertService';
import { systemService } from '@/services/systemService';
import { CircuitBreaker } from '@/utils/circuitBreaker';

export interface HealingConfig {
  intervals: {
    healthCheck: number; // in seconds
    autoRecovery: number;
  };
  thresholds: {
    maxFailures: number;
    recoveryTimeout: number;
    circuitBreakerThreshold: number;
  };
  autoHealing: {
    enabled: boolean;
    restartServices: boolean;
    rollbackTransactions: boolean;
    scaleResources: boolean;
  };
}

export interface HealingAction {
  id: string;
  type: 'restart' | 'rollback' | 'scale' | 'reconnect' | 'cleanup';
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  executedAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  errorMessage?: string;
}

export interface Failure {
  id: string;
  component: string;
  type: 'service' | 'database' | 'blockchain' | 'network' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  metrics: any;
  detectionSource: string;
  resolved: boolean;
  resolvedAt?: Date;
  healingActions?: HealingAction[];
}

export class HealingAgent {
  private config: HealingConfig;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private isRunning: boolean = false;
  private intervals: NodeJS.Timeout[] = [];
  private activeHealingActions: Map<string, HealingAction> = new Map();

  constructor(config: HealingConfig) {
    this.config = config;
    this.circuitBreakers = new Map();
  }

  /**
   * Start healing agent
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Healing agent is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting healing agent...');

    try {
      // Initialize circuit breakers for critical components
      this.initializeCircuitBreakers();

      // Start monitoring and healing loops
      this.startHealthMonitoring();
      this.startAutoRecovery();

      logger.info('Healing agent started successfully');
    } catch (error) {
      logger.error('Failed to start healing agent:', error);
      throw error;
    }
  }

  /**
   * Stop healing agent
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Healing agent is not running');
      return;
    }

    this.isRunning = false;
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    logger.info('Healing agent stopped');
  }

  /**
   * Detect and handle failures
   */
  public async detectFailures(): Promise<Failure[]> {
    const failures: Failure[] = [];

    try {
      // Check for service failures
      const serviceFailures = await this.detectServiceFailures();
      failures.push(...serviceFailures);

      // Check for database failures
      const databaseFailures = await this.detectDatabaseFailures();
      failures.push(...databaseFailures);

      // Check for blockchain failures
      const blockchainFailures = await this.detectBlockchainFailures();
      failures.push(...blockchainFailures);

      // Check for network failures
      const networkFailures = await this.detectNetworkFailures();
      failures.push(...networkFailures);

      // Check for resource failures
      const resourceFailures = await this.detectResourceFailures();
      failures.push(...resourceFailures);

      // Process detected failures
      for (const failure of failures) {
        await this.handleFailure(failure);
      }

    } catch (error) {
      logger.error('Error detecting failures:', error);
    }

    return failures;
  }

  /**
   * Execute healing action
   */
  public async executeHealingAction(action: HealingAction): Promise<HealingAction> {
    try {
      action.status = 'executing';
      action.executedAt = new Date();

      logger.info(`Executing healing action: ${action.type} for ${action.component}`, {
        actionId: action.id,
        type: action.type,
        component: action.component
      });

      let result;

      switch (action.type) {
        case 'restart':
          result = await this.restartService(action.component);
          break;
        case 'rollback':
          result = await this.rollbackTransaction(action.component);
          break;
        case 'scale':
          result = await this.scaleResources(action.component);
          break;
        case 'reconnect':
          result = await this.reconnectService(action.component);
          break;
        case 'cleanup':
          result = await this.cleanupResources(action.component);
          break;
        default:
          throw new Error(`Unknown healing action type: ${action.type}`);
      }

      action.status = 'completed';
      action.result = result;

      logger.info(`Healing action completed successfully`, {
        actionId: action.id,
        type: action.type,
        component: action.component
      });

      await alertService.sendRecoveryAlert(
        `Healing action ${action.type} completed for ${action.component}`,
        { action, result }
      );

    } catch (error) {
      action.status = 'failed';
      action.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Healing action failed`, {
        actionId: action.id,
        type: action.type,
        component: action.component,
        error: action.errorMessage
      });

      await alertService.sendCriticalAlert(
        `Healing action ${action.type} failed for ${action.component}`,
        { action, error: action.errorMessage }
      );
    }

    // Store healing action result
    await this.storeHealingAction(action);

    return action;
  }

  private initializeCircuitBreakers(): void {
    const components = ['database', 'blockchain', 'api', 'redis'];

    for (const component of components) {
      this.circuitBreakers.set(component, new CircuitBreaker({
        failureThreshold: this.config.thresholds.circuitBreakerThreshold,
        timeout: this.config.thresholds.recoveryTimeout,
        resetTimeout: 60000 // 1 minute
      }));
    }
  }

  private startHealthMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health monitoring failed:', error);
      }
    }, this.config.intervals.healthCheck * 1000);

    this.intervals.push(interval);
  }

  private startAutoRecovery(): void {
    if (!this.config.autoHealing.enabled) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.performAutoRecovery();
      } catch (error) {
        logger.error('Auto recovery failed:', error);
      }
    }, this.config.intervals.autoRecovery * 1000);

    this.intervals.push(interval);
  }

  private async performHealthCheck(): Promise<void> {
    const components = ['database', 'blockchain', 'api', 'redis'];

    for (const component of components) {
      const circuitBreaker = this.circuitBreakers.get(component);
      if (!circuitBreaker) continue;

      try {
        const isHealthy = await this.checkComponentHealth(component);
        
        if (isHealthy) {
          circuitBreaker.recordSuccess();
        } else {
          circuitBreaker.recordFailure();
        }

      } catch (error) {
        circuitBreaker.recordFailure();
        logger.warn(`Health check failed for ${component}:`, error);
      }
    }
  }

  private async performAutoRecovery(): Promise<void> {
    const failures = await this.detectFailures();

    for (const failure of failures) {
      if (failure.severity === 'critical' || failure.severity === 'high') {
        const healingAction = this.createHealingAction(failure);
        await this.executeHealingAction(healingAction);
      }
    }
  }

  private async detectServiceFailures(): Promise<Failure[]> {
    const failures: Failure[] = [];

    try {
      const serviceStatus = await systemService.getServiceStatus();

      for (const [service, status] of Object.entries(serviceStatus)) {
        if (!status.running || status.cpu > 90 || status.memory > 90) {
          failures.push({
            id: `service-${service}-${Date.now()}`,
            component: service,
            type: 'service',
            severity: status.running ? 'medium' : 'critical',
            description: status.running 
              ? `Service ${service} high resource usage (CPU: ${status.cpu}%, Memory: ${status.memory}%)`
              : `Service ${service} is not running`,
            timestamp: new Date(),
            metrics: status,
            detectionSource: 'system-monitor',
            resolved: false
          });
        }
      }
    } catch (error) {
      logger.error('Error detecting service failures:', error);
    }

    return failures;
  }

  private async detectDatabaseFailures(): Promise<Failure[]> {
    const failures: Failure[] = [];

    try {
      const dbHealth = await databaseService.getHealthMetrics();

      if (dbHealth.connections > dbHealth.maxConnections * 0.9) {
        failures.push({
          id: `db-connections-${Date.now()}`,
          component: 'database',
          type: 'database',
          severity: 'high',
          description: `Database connections approaching limit (${dbHealth.connections}/${dbHealth.maxConnections})`,
          timestamp: new Date(),
          metrics: dbHealth,
          detectionSource: 'database-monitor',
          resolved: false
        });
      }

      if (dbHealth.queryTime > 5000) {
        failures.push({
          id: `db-performance-${Date.now()}`,
          component: 'database',
          type: 'database',
          severity: 'medium',
          description: `Database query performance degraded (${dbHealth.queryTime}ms average)`,
          timestamp: new Date(),
          metrics: dbHealth,
          detectionSource: 'database-monitor',
          resolved: false
        });
      }
    } catch (error) {
      failures.push({
        id: `db-connection-${Date.now()}`,
        component: 'database',
        type: 'database',
        severity: 'critical',
        description: 'Database connection failed',
        timestamp: new Date(),
        metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
        detectionSource: 'database-monitor',
        resolved: false
      });
    }

    return failures;
  }

  private async detectBlockchainFailures(): Promise<Failure[]> {
    const failures: Failure[] = [];

    try {
      const bcHealth = await blockchainService.getHealthMetrics();

      if (bcHealth.blockDelay > 300) {
        failures.push({
          id: `bc-delay-${Date.now()}`,
          component: 'blockchain',
          type: 'blockchain',
          severity: 'high',
          description: `Blockchain block delay too high (${bcHealth.blockDelay} seconds)`,
          timestamp: new Date(),
          metrics: bcHealth,
          detectionSource: 'blockchain-monitor',
          resolved: false
        });
      }

      if (bcHealth.failedTransactions > 10) {
        failures.push({
          id: `bc-failed-tx-${Date.now()}`,
          component: 'blockchain',
          type: 'blockchain',
          severity: 'medium',
          description: `High number of failed transactions (${bcHealth.failedTransactions})`,
          timestamp: new Date(),
          metrics: bcHealth,
          detectionSource: 'blockchain-monitor',
          resolved: false
        });
      }
    } catch (error) {
      failures.push({
        id: `bc-connection-${Date.now()}`,
        component: 'blockchain',
        type: 'blockchain',
        severity: 'critical',
        description: 'Blockchain connection failed',
        timestamp: new Date(),
        metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
        detectionSource: 'blockchain-monitor',
        resolved: false
      });
    }

    return failures;
  }

  private async detectNetworkFailures(): Promise<Failure[]> {
    const failures: Failure[] = [];

    try {
      const networkMetrics = await systemService.getNetworkMetrics();

      if (networkMetrics.packetLoss > 5) {
        failures.push({
          id: `network-loss-${Date.now()}`,
          component: 'network',
          type: 'network',
          severity: 'medium',
          description: `Network packet loss detected (${networkMetrics.packetLoss}%)`,
          timestamp: new Date(),
          metrics: networkMetrics,
          detectionSource: 'network-monitor',
          resolved: false
        });
      }

      if (networkMetrics.latency > 1000) {
        failures.push({
          id: `network-latency-${Date.now()}`,
          component: 'network',
          type: 'network',
          severity: 'high',
          description: `High network latency detected (${networkMetrics.latency}ms)`,
          timestamp: new Date(),
          metrics: networkMetrics,
          detectionSource: 'network-monitor',
          resolved: false
        });
      }
    } catch (error) {
      logger.error('Error detecting network failures:', error);
    }

    return failures;
  }

  private async detectResourceFailures(): Promise<Failure[]> {
    const failures: Failure[] = [];

    try {
      const resourceMetrics = await systemService.getResourceMetrics();

      if (resourceMetrics.cpu > 90) {
        failures.push({
          id: `cpu-high-${Date.now()}`,
          component: 'system',
          type: 'resource',
          severity: 'high',
          description: `High CPU usage detected (${resourceMetrics.cpu}%)`,
          timestamp: new Date(),
          metrics: resourceMetrics,
          detectionSource: 'resource-monitor',
          resolved: false
        });
      }

      if (resourceMetrics.memory > 90) {
        failures.push({
          id: `memory-high-${Date.now()}`,
          component: 'system',
          type: 'resource',
          severity: 'critical',
          description: `High memory usage detected (${resourceMetrics.memory}%)`,
          timestamp: new Date(),
          metrics: resourceMetrics,
          detectionSource: 'resource-monitor',
          resolved: false
        });
      }

      if (resourceMetrics.disk > 85) {
        failures.push({
          id: `disk-high-${Date.now()}`,
          component: 'system',
          type: 'resource',
          severity: 'medium',
          description: `High disk usage detected (${resourceMetrics.disk}%)`,
          timestamp: new Date(),
          metrics: resourceMetrics,
          detectionSource: 'resource-monitor',
          resolved: false
        });
      }
    } catch (error) {
      logger.error('Error detecting resource failures:', error);
    }

    return failures;
  }

  private async handleFailure(failure: Failure): Promise<void> {
    // Check if failure already exists and is unresolved
    const existingFailure = await databaseService.getFailure(failure.id);
    if (existingFailure && !existingFailure.resolved) {
      return;
    }

    // Store new failure
    await databaseService.storeFailure(failure);

    // Send alert
    await alertService.sendFailureAlert(
      `Failure detected in ${failure.component}`,
      failure
    );

    logger.warn('Failure detected and stored', {
      failureId: failure.id,
      component: failure.component,
      type: failure.type,
      severity: failure.severity,
      description: failure.description
    });
  }

  private createHealingAction(failure: Failure): HealingAction {
    const actionId = `healing-${failure.component}-${Date.now()}`;
    
    let actionType: HealingAction['type'];
    let severity: HealingAction['severity'];

    switch (failure.type) {
      case 'service':
        actionType = 'restart';
        severity = failure.severity;
        break;
      case 'blockchain':
        actionType = 'reconnect';
        severity = failure.severity;
        break;
      case 'database':
        actionType = failure.type === 'database' && failure.description.includes('connection') ? 'reconnect' : 'cleanup';
        severity = failure.severity;
        break;
      case 'resource':
        actionType = 'scale';
        severity = failure.severity;
        break;
      default:
        actionType = 'restart';
        severity = failure.severity;
    }

    return {
      id: actionId,
      type: actionType,
      component: failure.component,
      severity,
      description: `Auto-healing action for ${failure.description}`,
      status: 'pending'
    };
  }

  private async restartService(service: string): Promise<any> {
    logger.info(`Restarting service: ${service}`);
    return await systemService.restartService(service);
  }

  private async rollbackTransaction(txHash: string): Promise<any> {
    logger.info(`Rolling back transaction: ${txHash}`);
    return await blockchainService.rollbackTransaction(txHash);
  }

  private async scaleResources(component: string): Promise<any> {
    logger.info(`Scaling resources for: ${component}`);
    return await systemService.scaleResources(component);
  }

  private async reconnectService(service: string): Promise<any> {
    logger.info(`Reconnecting to: ${service}`);
    
    switch (service) {
      case 'database':
        return await databaseService.reconnect();
      case 'blockchain':
        return await blockchainService.reconnect();
      default:
        throw new Error(`Unknown service for reconnection: ${service}`);
    }
  }

  private async cleanupResources(component: string): Promise<any> {
    logger.info(`Cleaning up resources for: ${component}`);
    
    switch (component) {
      case 'database':
        return await databaseService.cleanup();
      case 'system':
        return await systemService.cleanup();
      default:
        throw new Error(`Unknown component for cleanup: ${component}`);
    }
  }

  private async checkComponentHealth(component: string): Promise<boolean> {
    try {
      switch (component) {
        case 'database':
          await databaseService.healthCheck();
          return true;
        case 'blockchain':
          await blockchainService.healthCheck();
          return true;
        case 'api':
          const response = await fetch('http://localhost:3001/health');
          return response.ok;
        case 'redis':
          // await redisClient.ping();
          return true;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  private async storeHealingAction(action: HealingAction): Promise<void> {
    try {
      await databaseService.storeHealingAction(action);
    } catch (error) {
      logger.error('Failed to store healing action:', error);
    }
  }
}