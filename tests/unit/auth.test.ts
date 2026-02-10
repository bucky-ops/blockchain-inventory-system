import request from 'supertest';
import { expect } from 'chai';
import app from '../src/index';

describe('Authentication API', () => {
  describe('POST /api/v1/auth/nonce', () => {
    it('should generate nonce for valid wallet address', async () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      
      const response = await request(app)
        .post('/api/v1/auth/nonce')
        .send({ address: validAddress })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('nonce');
      expect(response.body.data).to.have.property('expiresAt');
      expect(response.body.data.address).to.equal(validAddress);
    });

    it('should reject invalid wallet address', async () => {
      const response = await request(app)
        .post('/api/v1/auth/nonce')
        .send({ address: 'invalid-address' })
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('Valid wallet address');
    });

    it('should require address field', async () => {
      const response = await request(app)
        .post('/api/v1/auth/nonce')
        .send({})
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('Valid wallet address');
    });
  });

  describe('POST /api/v1/auth/verify', () => {
    it('should verify valid message signature', async () => {
      const message = 'Test message';
      const address = '0x1234567890123456789012345678901234567890';
      const signature = '0x1234567890abcdef';

      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({
          message,
          address,
          signature
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('isValid');
    });
  });
});