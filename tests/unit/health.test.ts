import request from 'supertest';
import { expect } from 'chai';
import app from '../src/index';

describe('Health Check API', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).to.have.property('success');
    expect(response.body).to.have.property('data');
    expect(response.body.data).to.have.property('status');
    expect(response.body.data).to.have.property('timestamp');
  });

  it('should return database health status', async () => {
    const response = await request(app)
      .get('/health/database')
      .expect(200);

    expect(response.body).to.have.property('success');
    expect(response.body.data).to.have.property('status');
  });

  it('should return blockchain health status', async () => {
    const response = await request(app)
      .get('/health/blockchain')
      .expect(200);

    expect(response.body).to.have.property('success');
    expect(response.body.data).to.have.property('status');
  });
});