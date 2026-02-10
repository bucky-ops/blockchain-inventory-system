import { expect, describe, it, beforeAll, afterAll, beforeEach } from '@jest/globals'
import request from 'supertest'
import app from '../src/app'
import { setupTestDatabase, cleanupTestDatabase, seedTestData } from './helpers/database'
import { ethers } from 'ethers'

describe('API Integration Tests', () => {
  let adminToken: string
  let managerToken: string
  let operatorToken: string
  let viewerToken: string

  beforeAll(async () => {
    await setupTestDatabase()
    
    // Create test users and get tokens
    const adminWallet = ethers.Wallet.createRandom()
    const managerWallet = ethers.Wallet.createRandom()
    const operatorWallet = ethers.Wallet.createRandom()
    const viewerWallet = ethers.Wallet.createRandom()

    // Get nonces for each user
    const adminNonce = await request(app)
      .post('/api/v1/auth/nonce')
      .send({ address: adminWallet.address })
      .expect(200)

    const managerNonce = await request(app)
      .post('/api/v1/auth/nonce')
      .send({ address: managerWallet.address })
      .expect(200)

    const operatorNonce = await request(app)
      .post('/api/v1/auth/nonce')
      .send({ address: operatorWallet.address })
      .expect(200)

    const viewerNonce = await request(app)
      .post('/api/v1/auth/nonce')
      .send({ address: viewerWallet.address })
      .expect(200)

    // Sign login messages
    const adminSignature = await adminWallet.signMessage(`Login to Inventory System: ${adminNonce.body.data.nonce}`)
    const managerSignature = await managerWallet.signMessage(`Login to Inventory System: ${managerNonce.body.data.nonce}`)
    const operatorSignature = await operatorWallet.signMessage(`Login to Inventory System: ${operatorNonce.body.data.nonce}`)
    const viewerSignature = await viewerWallet.signMessage(`Login to Inventory System: ${viewerNonce.body.data.nonce}`)

    // Login and get tokens
    adminToken = (await request(app)
      .post('/api/v1/auth/login')
      .send({
        address: adminWallet.address,
        signature: adminSignature,
        nonce: adminNonce.body.data.nonce
      })
      .expect(200)).body.data.tokens.accessToken

    managerToken = (await request(app)
      .post('/api/v1/auth/login')
      .send({
        address: managerWallet.address,
        signature: managerSignature,
        nonce: managerNonce.body.data.nonce
      })
      .expect(200)).body.data.tokens.accessToken

    operatorToken = (await request(app)
      .post('/api/v1/auth/login')
      .send({
        address: operatorWallet.address,
        signature: operatorSignature,
        nonce: operatorNonce.body.data.nonce
      })
      .expect(200)).body.data.tokens.accessToken

    viewerToken = (await request(app)
      .post('/api/v1/auth/login')
      .send({
        address: viewerWallet.address,
        signature: viewerSignature,
        nonce: viewerNonce.body.data.nonce
      })
      .expect(200)).body.data.tokens.accessToken
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    // Clean up test data before each test
    await seedTestData()
  })

  describe('Authentication Endpoints', () => {
    it('should get nonce for login', async () => {
      const wallet = ethers.Wallet.createRandom()
      
      const response = await request(app)
        .post('/api/v1/auth/nonce')
        .send({ address: wallet.address })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.address).toBe(wallet.address)
      expect(response.body.data.nonce).toBeDefined()
      expect(response.body.data.expiresAt).toBeDefined()
    })

    it('should login with valid signature', async () => {
      const wallet = ethers.Wallet.createRandom()
      
      const nonceResponse = await request(app)
        .post('/api/v1/auth/nonce')
        .send({ address: wallet.address })
        .expect(200)

      const signature = await wallet.signMessage(`Login to Inventory System: ${nonceResponse.body.data.nonce}`)

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          address: wallet.address,
          signature: signature,
          nonce: nonceResponse.body.data.nonce
        })
        .expect(200)

      expect(loginResponse.body.success).toBe(true)
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined()
      expect(loginResponse.body.data.tokens.refreshToken).toBeDefined()
      expect(loginResponse.body.data.user.address).toBe(wallet.address)
    })

    it('should reject login with invalid signature', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          address: '0x1234567890123456789012345678901234567890',
          signature: 'invalid_signature',
          nonce: '123'
        })
        .expect(401)
    })

    it('should refresh token', async () => {
      const wallet = ethers.Wallet.createRandom()
      
      // First login to get refresh token
      const nonceResponse = await request(app)
        .post('/api/v1/auth/nonce')
        .send({ address: wallet.address })
        .expect(200)

      const signature = await wallet.signMessage(`Login to Inventory System: ${nonceResponse.body.data.nonce}`)

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          address: wallet.address,
          signature: signature,
          nonce: nonceResponse.body.data.nonce
        })
        .expect(200)

      const refreshToken = loginResponse.body.data.tokens.refreshToken

      // Refresh the token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(refreshResponse.body.success).toBe(true)
      expect(refreshResponse.body.data.accessToken).toBeDefined()
    })
  })

  describe('Inventory Endpoints', () => {
    let testItemId: number

    it('should create inventory item (operator)', async () => {
      const itemData = {
        sku: 'TEST-001',
        name: 'Test Item',
        description: 'Test item description',
        category: 'Electronics',
        quantity: 100,
        location: 'Warehouse A',
        metadataHash: 'QmTest123...'
      }

      const response = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(itemData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      testItemId = response.body.data.id
    })

    it('should get all inventory items (viewer)', async () => {
      const response = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data.items)).toBe(true)
      expect(response.body.data.total).toBeGreaterThan(0)
    })

    it('should update inventory quantity (operator)', async () => {
      if (!testItemId) {
        throw new Error('Test item ID not set')
      }

      const response = await request(app)
        .put(`/api/v1/inventory/${testItemId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          quantity: 150,
          reason: 'Stock adjustment'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.quantity).toBe(150)
    })

    it('should transfer inventory item (operator)', async () => {
      if (!testItemId) {
        throw new Error('Test item ID not set')
      }

      const response = await request(app)
        .post(`/api/v1/inventory/${testItemId}/transfer`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          toLocation: 'Warehouse B',
          quantity: 25,
          reason: 'Internal transfer'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.transactionHash).toBeDefined()
    })

    it('should prevent viewer from creating items', async () => {
      const itemData = {
        sku: 'TEST-002',
        name: 'Test Item 2',
        description: 'Test item 2 description',
        category: 'Electronics',
        quantity: 50,
        location: 'Warehouse C',
        metadataHash: 'QmTest456...'
      }

      await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(itemData)
        .expect(403)
    })
  })

  describe('User Management Endpoints', () => {
    it('should get all users (admin)', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data.users)).toBe(true)
    })

    it('should prevent viewer from accessing users', async () => {
      await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403)
    })

    it('should register new user (admin)', async () => {
      const newWallet = ethers.Wallet.createRandom()
      const userData = {
        address: newWallet.address,
        email: 'testuser@example.com',
        fullName: 'Test User',
        role: 'OPERATOR',
        adminSignature: 'dummy_signature' // Would be real signature in actual test
      }

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.address).toBe(newWallet.address)
    })
  })

  describe('Audit Endpoints', () => {
    it('should get audit logs (auditor)', async () => {
      const response = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data.logs)).toBe(true)
    })

    it('should get audit logs by event type', async () => {
      const response = await request(app)
        .get('/api/v1/audit?eventType=INVENTORY_OPERATION')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data.logs)).toBe(true)
    })
  })

  describe('Security Tests', () => {
    it('should prevent SQL injection', async () => {
      await request(app)
        .get('/api/v1/inventory?id=1; DROP TABLE users;--')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(400)
    })

    it('should prevent XSS attacks', async () => {
      const maliciousData = {
        sku: '<script>alert("xss")</script>',
        name: 'Test XSS',
        description: '<img src=x onerror=alert("xss")>',
        category: 'Electronics',
        quantity: 10,
        location: 'Warehouse A',
        metadataHash: 'QmTest789...'
      }

      await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(maliciousData)
        .expect(400)
    })

    it('should enforce rate limiting', async () => {
      // Make many requests quickly to trigger rate limiting
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/nonce')
          .send({ address: '0x1234567890123456789012345678901234567890' })
      )

      const responses = await Promise.all(promises)
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/inventory')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(200)
      )

      const startTime = Date.now()
      await Promise.all(promises)
      const endTime = Date.now()

      // All requests should complete within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should handle large dataset queries efficiently', async () => {
      const response = await request(app)
        .get('/api/v1/inventory?limit=1000')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      // Response time should be reasonable for large datasets
      expect(response.headers['x-response-time']).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent resources', async () => {
      await request(app)
        .get('/api/v1/inventory/999999')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(404)
    })

    it('should handle malformed requests', async () => {
      await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ invalid: 'data' })
        .expect(400)
    })

    it('should provide consistent error response format', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-endpoint')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBeDefined()
      expect(response.body.statusCode).toBe(404)
    })
  })
})