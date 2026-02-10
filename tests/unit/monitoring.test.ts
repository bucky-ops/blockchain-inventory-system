import { expect } from 'chai';
import { ethers } from 'ethers';
import { MonitoringAgent } from '../ai-agents/src/monitoring/MonitoringAgent';
import config from '../ai-agents/src/config';

describe('Monitoring Agent', () => {
  let monitoringAgent: MonitoringAgent;

  before(() => {
    const monitoringConfig = config.monitoring;
    monitoringAgent = new MonitoringAgent(monitoringConfig);
  });

  describe('Health Checks', () => {
    it('should check API health', async () => {
      const health = await monitoringAgent.getHealthStatus();
      
      expect(health).to.have.property('status');
      expect(health).to.have.property('timestamp');
      expect(health).to.have.property('components');
      expect(health.components).to.have.property('database');
      expect(health.components).to.have.property('blockchain');
      expect(health.components).to.have.property('api');
      expect(health.components).to.have.property('redis');
    });

    it('should detect anomalies', async () => {
      const anomalies = await monitoringAgent.detectAnomalies();
      
      expect(anomalies).to.be.an('array');
      // Each anomaly should have required properties
      anomalies.forEach(anomaly => {
        expect(anomaly).to.have.property('id');
        expect(anomaly).to.have.property('type');
        expect(anomaly).to.have.property('severity');
        expect(anomaly).to.have.property('description');
        expect(anomaly).to.have.property('timestamp');
        expect(anomaly).to.have.property('detectedBy');
      });
    });
  });

  describe('Configuration', () => {
    it('should use environment variables', () => {
      expect(config.api.url).to.be.a('string');
      expect(config.database.host).to.be.a('string');
      expect(config.redis.host).to.be.a('string');
      expect(config.blockchain.rpcUrl).to.be.a('string');
      expect(config.monitoring.enabled).to.be.a('boolean');
    });
  });
});