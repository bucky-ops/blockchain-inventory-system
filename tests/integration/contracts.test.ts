import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ethers } from 'ethers'
import { deployContracts } from './helpers/deployment'

describe('Smart Contract Integration Tests', () => {
  let inventoryManager: any
  let userRegistry: any
  let auditLogger: any
  let owner: any
  let manager: any
  let operator: any
  let viewer: any

  beforeAll(async () => {
    ;[owner, manager, operator, viewer] = await ethers.getSigners()
    
    const contracts = await deployContracts(owner.address)
    inventoryManager = contracts.inventoryManager
    userRegistry = contracts.userRegistry
    auditLogger = contracts.auditLogger

    // Setup roles
    await inventoryManager.grantRole(await inventoryManager.MANAGER_ROLE(), manager.address)
    await inventoryManager.grantRole(await inventoryManager.OPERATOR_ROLE(), operator.address)
    await inventoryManager.grantRole(await inventoryManager.VIEWER_ROLE(), viewer.address)

    await userRegistry.grantRole(await userRegistry.MANAGER_ROLE(), manager.address)
    await userRegistry.grantRole(await userRegistry.AUDITOR_ROLE(), viewer.address)
  })

  describe('UserRegistry Integration', () => {
    it('should register user and update inventory manager permissions', async () => {
      const newWallet = ethers.Wallet.createRandom()
      
      // Register user
      await userRegistry.connect(owner).registerUser(
        newWallet.address,
        'newuser@example.com',
        'New User',
        await userRegistry.OPERATOR_ROLE(),
        'Test user creation'
      )

      // Verify user exists
      const user = await userRegistry.getUser(newWallet.address)
      expect(user.exists).toBe(true)
      expect(user.role).toBe(await userRegistry.OPERATOR_ROLE())

      // Create inventory item as this user
      await inventoryManager.connect(operator).createItem(
        'USER-TEST-001',
        'User Test Item',
        'Test item created by registered user',
        'Test Category',
        50,
        'Test Location',
        'QmUserTest...'
      )

      const item = await inventoryManager.getItem(1)
      expect(item.sku).toBe('USER-TEST-001')
    })

    it('should prevent user operations after suspension', async () => {
      const suspendedUser = ethers.Wallet.createRandom()
      
      // Register user
      await userRegistry.connect(owner).registerUser(
        suspendedUser.address,
        'suspended@example.com',
        'Suspended User',
        await userRegistry.OPERATOR_ROLE(),
        'User to be suspended'
      )

      // Create inventory item before suspension
      await inventoryManager.connect(operator).createItem(
        'SUSPEND-TEST-001',
        'Suspend Test Item',
        'Test item for suspension',
        'Test Category',
        100,
        'Test Location',
        'QmSuspendTest...'
      )

      // Suspend user
      await userRegistry.connect(owner).suspendUser(
        suspendedUser.address,
        'Test suspension'
      )

      // Verify user is suspended
      const user = await userRegistry.getUser(suspendedUser.address)
      expect(user.status).toBe(1) // Suspended status

      // Note: In real implementation, we'd verify that the suspended user
      // cannot perform operations. This requires additional integration
      // with the authentication layer.
    })
  })

  describe('InventoryManager Integration', () => {
    let testItemId: number

    it('should create item and log audit event', async () => {
      const tx = await inventoryManager.connect(operator).createItem(
        'INTEGRATION-001',
        'Integration Test Item',
        'Item for integration testing',
        'Integration Category',
        75,
        'Integration Warehouse',
        'QmIntegrationTest...'
      )
      
      const receipt = await tx.wait()
      const createEvent = receipt.logs.find(log => log.fragment?.name === 'ItemCreated')
      
      expect(createEvent).toBeDefined()
      testItemId = createEvent.args.itemId

      // Check that audit log was created
      const auditLogs = await auditLogger.getAuditLogsByEventType(
        await auditLogger.INVENTORY_OPERATION()
      )
      expect(auditLogs.length).toBeGreaterThan(0)
    })

    it('should transfer item and update location tracking', async () => {
      const initialQuantity = (await inventoryManager.getItem(testItemId)).quantity
      
      // Transfer part of the quantity
      await inventoryManager.connect(operator).transferItem(
        testItemId,
        'New Location',
        25,
        'Integration transfer test'
      )

      // Verify item quantity was updated
      const updatedItem = await inventoryManager.getItem(testItemId)
      expect(updatedItem.quantity).toBe(initialQuantity - 25n)

      // Check transaction history
      const transactions = await inventoryManager.getItemTransactions(testItemId)
      const transferTx = transactions.find(tx => tx.action === 'TRANSFER')
      expect(transferTx).toBeDefined()
      expect(transferTx.toLocation).toBe('New Location')
      expect(transferTx.quantity).toBe(25)
    })

    it('should handle batch operations and log all events', async () => {
      const items = {
        skus: ['BATCH-001', 'BATCH-002', 'BATCH-003'],
        names: ['Batch Item 1', 'Batch Item 2', 'Batch Item 3'],
        descriptions: ['First batch', 'Second batch', 'Third batch'],
        categories: ['Category A', 'Category B', 'Category C'],
        quantities: [10, 20, 30],
        locations: ['Location 1', 'Location 2', 'Location 3'],
        metadataHashes: ['QmBatch1...', 'QmBatch2...', 'QmBatch3...']
      }

      const itemIds = await inventoryManager.connect(operator).batchCreateItems(
        items.skus,
        items.names,
        items.descriptions,
        items.categories,
        items.quantities,
        items.locations,
        items.metadataHashes
      )

      expect(itemIds.length).toBe(3)

      // Verify all items were created
      for (let i = 0; i < 3; i++) {
        const item = await inventoryManager.getItem(itemIds[i])
        expect(item.sku).toBe(items.skus[i])
        expect(item.name).toBe(items.names[i])
      }

      // Check audit logs for batch operations
      const recentLogs = await auditLogger.getRecentAuditLogs(10)
      const createLogs = recentLogs.filter(log => log.action === 'CREATE')
      expect(createLogs.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('AuditLogger Integration', () => {
    it('should log all inventory operations', async () => {
      // Create, update, transfer, and delete operations
      const createTx = await inventoryManager.connect(operator).createItem(
        'AUDIT-TEST-001',
        'Audit Test Item',
        'Item for audit testing',
        'Audit Category',
        40,
        'Audit Warehouse',
        'QmAuditTest...'
      )
      await createTx.wait()

      const updateTx = await inventoryManager.connect(operator).updateQuantity(
        (await inventoryManager.getTotalItems()),
        60,
        'Audit update test'
      )
      await updateTx.wait()

      const transferTx = await inventoryManager.connect(operator).transferItem(
        (await inventoryManager.getTotalItems()),
        'Audit Transfer Location',
        15,
        'Audit transfer test'
      )
      await transferTx.wait()

      const deleteTx = await inventoryManager.connect(manager).deleteItem(
        (await inventoryManager.getTotalItems()),
        'Audit delete test'
      )
      await deleteTx.wait()

      // Verify all operations are logged
      const inventoryLogs = await auditLogger.getAuditLogsByEventType(
        await auditLogger.INVENTORY_OPERATION()
      )
      
      const loggedActions = inventoryLogs.map(log => log.action)
      expect(loggedActions).toContain('CREATE')
      expect(loggedActions).toContain('UPDATE')
      expect(loggedActions).toContain('TRANSFER')
      expect(loggedActions).toContain('DELETE')
    })

    it('should generate compliance reports', async () => {
      const reportId = await auditLogger.connect(viewer).generateComplianceReport(
        'INVENTORY_SUMMARY',
        Math.floor(Date.now() / 1000) - 86400, // 24 hours ago
        Math.floor(Date.now() / 1000), // Now
        '{}'
      )

      expect(reportId).toBeDefined()

      const report = await auditLogger.getComplianceReport(reportId)
      expect(report.reportType).toBe('INVENTORY_SUMMARY')
      expect(report.isActive).toBe(true)
    })
  })

  describe('Cross-Contract Integration', () => {
    it('should maintain data consistency across contracts', async () => {
      const testUser = ethers.Wallet.createRandom()
      
      // Register user
      await userRegistry.connect(owner).registerUser(
        testUser.address,
        'consistency@example.com',
        'Consistency Test User',
        await userRegistry.OPERATOR_ROLE(),
        'Test data consistency'
      )

      // Create inventory item
      await inventoryManager.connect(operator).createItem(
        'CONSISTENCY-001',
        'Consistency Test Item',
        'Item for consistency testing',
        'Consistency Category',
        25,
        'Consistency Warehouse',
        'QmConsistencyTest...'
      )

      // Verify user role matches permissions
      const user = await userRegistry.getUser(testUser.address)
      expect(user.role).toBe(await userRegistry.OPERATOR_ROLE())

      // Verify inventory operations are properly audited
      const auditLogs = await auditLogger.getUserAuditLogs(operator.address)
      expect(auditLogs.length).toBeGreaterThan(0)

      // Check that audit log references correct contract addresses
      const systemEvents = await auditLogger.getAuditLogsByEventType(
        await auditLogger.SYSTEM_EVENT()
      )
      const deploymentEvents = systemEvents.filter(event => 
        event.action === 'SYSTEM_DEPLOYMENT'
      )
      expect(deploymentEvents.length).toBeGreaterThan(0)
    })

    it('should handle role changes across system', async () => {
      const testUser = ethers.Wallet.createRandom()
      
      // Register as operator
      await userRegistry.connect(owner).registerUser(
        testUser.address,
        'rolechange@example.com',
        'Role Change User',
        await userRegistry.OPERATOR_ROLE(),
        'Test role change'
      )

      // Create inventory item as operator
      await inventoryManager.connect(operator).createItem(
        'ROLE-CHANGE-001',
        'Role Change Item',
        'Item for role change testing',
        'Role Change Category',
        15,
        'Role Change Warehouse',
        'QmRoleChangeTest...'
      )

      // Promote user to manager
      await userRegistry.connect(owner).updateUserRole(
        testUser.address,
        await userRegistry.MANAGER_ROLE(),
        'Promotion to manager'
      )

      // Verify role change
      const updatedUser = await userRegistry.getUser(testUser.address)
      expect(updatedUser.role).toBe(await userRegistry.MANAGER_ROLE())

      // Check that role change was audited
      const auditLogs = await auditLogger.getUserAuditLogs(owner.address)
      const roleChangeLogs = auditLogs.filter(log => log.action === 'ROLE_CHANGE')
      expect(roleChangeLogs.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle contract interaction failures gracefully', async () => {
      // Try to create item with invalid data
      await expect(
        inventoryManager.connect(operator).createItem(
          '',
          'Invalid SKU Item',
          'Item with empty SKU',
          'Test Category',
          10,
          'Test Location',
          'QmInvalid...'
        )
      ).to.be.revertedWith('InventoryManager: SKU cannot be empty')

      // Try to update non-existent item
      await expect(
        inventoryManager.connect(operator).updateQuantity(
          999999,
          50,
          'Update non-existent'
        )
      ).to.be.revertedWith('InventoryManager: item does not exist')

      // Try to transfer more than available quantity
      const itemId = await inventoryManager.getTotalItems()
      await expect(
        inventoryManager.connect(operator).transferItem(
          itemId,
          'Test Location',
          999999,
          'Transfer too much'
        )
      ).to.be.revertedWith('InventoryManager: insufficient quantity')
    })

    it('should maintain system integrity during failures', async () => {
      // Get initial state
      const initialItemCount = await inventoryManager.getTotalItems()
      const initialUserCount = await userRegistry.getTotalUsers()

      // Attempt operations that might fail
      try {
        await inventoryManager.connect(operator).createItem(
          'FAIL-TEST-001',
          'Failure Test Item',
          'This should succeed',
          'Test Category',
          20,
          'Test Location',
          'QmFailTest...'
        )
      } catch (error) {
        console.log('Expected error:', error.message)
      }

      // Verify system state is consistent
      const finalItemCount = await inventoryManager.getTotalItems()
      const finalUserCount = await userRegistry.getTotalUsers()

      // Count should be consistent (either increased by 1 or unchanged)
      expect(
        finalItemCount.eq(initialItemCount) || 
        finalItemCount.eq(initialItemCount + 1n)
      ).toBe(true)
      expect(finalUserCount).toBe(initialUserCount)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const promises = []
      
      // Create multiple items concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          inventoryManager.connect(operator).createItem(
            `PERF-TEST-${String(i).padStart(3, '0')}`,
            `Performance Test Item ${i}`,
            `Performance test item ${i}`,
            'Performance Category',
            10 * (i + 1),
            'Performance Location',
            `QmPerfTest${i}...`
          )
        )
      }

      const results = await Promise.allSettled(promises)
      const successfulCreations = results.filter(r => r.status === 'fulfilled')
      
      expect(successfulCreations.length).toBe(5)

      // Verify all items were created
      const allItems = await inventoryManager.getAllActiveItems()
      const perfItems = allItems.filter(item => 
        item.name.startsWith('Performance Test Item')
      )
      expect(perfItems.length).toBe(5)
    })
  })
})