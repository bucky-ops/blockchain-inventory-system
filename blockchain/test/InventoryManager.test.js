const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("InventoryManager", function () {
  let inventoryManager;
  let owner, manager, operator, viewer, outsider;
  
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const VIEWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VIEWER_ROLE"));

  async function deployInventoryManagerFixture() {
    [owner, manager, operator, viewer, outsider] = await ethers.getSigners();

    const InventoryManager = await ethers.getContractFactory("InventoryManager");
    inventoryManager = await InventoryManager.deploy(owner.address);
    
    // Grant roles
    await inventoryManager.grantRole(MANAGER_ROLE, manager.address);
    await inventoryManager.grantRole(OPERATOR_ROLE, operator.address);
    await inventoryManager.grantRole(VIEWER_ROLE, viewer.address);

    return { inventoryManager, owner, manager, operator, viewer, outsider };
  }

  beforeEach(async function () {
    ({ inventoryManager, owner, manager, operator, viewer, outsider } = await loadFixture(deployInventoryManagerFixture));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await inventoryManager.hasRole(ADMIN_ROLE, owner.address)).to.equal(true);
    });

    it("Should grant correct roles", async function () {
      expect(await inventoryManager.hasRole(MANAGER_ROLE, manager.address)).to.equal(true);
      expect(await inventoryManager.hasRole(OPERATOR_ROLE, operator.address)).to.equal(true);
      expect(await inventoryManager.hasRole(VIEWER_ROLE, viewer.address)).to.equal(true);
    });
  });

  describe("Item Creation", function () {
    const itemData = {
      sku: "TEST-001",
      name: "Test Item",
      description: "A test item for unit testing",
      category: "Electronics",
      quantity: 100,
      location: "Warehouse A",
      metadataHash: "QmTest123..."
    };

    it("Should allow operator to create item", async function () {
      const tx = await inventoryManager.connect(operator).createItem(
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.quantity,
        itemData.location,
        itemData.metadataHash
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ItemCreated");
      
      expect(event).to.not.be.undefined;
      expect(event.args.itemId).to.equal(1);
      expect(event.args.sku).to.equal(itemData.sku);
      expect(event.args.name).to.equal(itemData.name);
      expect(event.args.quantity).to.equal(itemData.quantity);

      const item = await inventoryManager.getItem(1);
      expect(item.id).to.equal(1);
      expect(item.sku).to.equal(itemData.sku);
      expect(item.name).to.equal(itemData.name);
      expect(item.quantity).to.equal(itemData.quantity);
      expect(item.isActive).to.equal(true);
    });

    it("Should prevent duplicate SKUs", async function () {
      await inventoryManager.connect(operator).createItem(
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.quantity,
        itemData.location,
        itemData.metadataHash
      );

      await expect(
        inventoryManager.connect(operator).createItem(
          itemData.sku,
          "Another Item",
          itemData.description,
          itemData.category,
          itemData.quantity,
          itemData.location,
          itemData.metadataHash
        )
      ).to.be.revertedWith("InventoryManager: SKU already exists");
    });

    it("Should prevent viewer from creating items", async function () {
      await expect(
        inventoryManager.connect(viewer).createItem(
          itemData.sku,
          itemData.name,
          itemData.description,
          itemData.category,
          itemData.quantity,
          itemData.location,
          itemData.metadataHash
        )
      ).to.be.revertedWith("InventoryManager: caller is not operator or above");
    });

    it("Should validate item data", async function () {
      await expect(
        inventoryManager.connect(operator).createItem(
          "",
          itemData.name,
          itemData.description,
          itemData.category,
          itemData.quantity,
          itemData.location,
          itemData.metadataHash
        )
      ).to.be.revertedWith("InventoryManager: SKU cannot be empty");

      await expect(
        inventoryManager.connect(operator).createItem(
          itemData.sku,
          "",
          itemData.description,
          itemData.category,
          itemData.quantity,
          itemData.location,
          itemData.metadataHash
        )
      ).to.be.revertedWith("InventoryManager: name cannot be empty");

      await expect(
        inventoryManager.connect(operator).createItem(
          itemData.sku,
          itemData.name,
          itemData.description,
          itemData.category,
          0,
          itemData.location,
          itemData.metadataHash
        )
      ).to.be.revertedWith("InventoryManager: quantity must be positive");
    });
  });

  describe("Item Updates", function () {
    const itemData = {
      sku: "TEST-002",
      name: "Update Test Item",
      description: "Item for update testing",
      category: "Test",
      quantity: 50,
      location: "Warehouse B",
      metadataHash: "QmUpdate123..."
    };

    beforeEach(async function () {
      await inventoryManager.connect(operator).createItem(
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.quantity,
        itemData.location,
        itemData.metadataHash
      );
    });

    it("Should allow operator to update quantity", async function () {
      const newQuantity = 75;
      const reason = "Stock replenishment";

      const tx = await inventoryManager.connect(operator).updateQuantity(1, newQuantity, reason);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ItemUpdated");

      expect(event.args.itemId).to.equal(1);
      expect(event.args.oldQuantity).to.equal(50);
      expect(event.args.newQuantity).to.equal(newQuantity);

      const item = await inventoryManager.getItem(1);
      expect(item.quantity).to.equal(newQuantity);
    });

    it("Should prevent updating with same quantity", async function () {
      await expect(
        inventoryManager.connect(operator).updateQuantity(1, 50, "No change")
      ).to.be.revertedWith("InventoryManager: quantity unchanged");
    });

    it("Should prevent viewer from updating items", async function () {
      await expect(
        inventoryManager.connect(viewer).updateQuantity(1, 60, "Test update")
      ).to.be.revertedWith("InventoryManager: caller is not operator or above");
    });
  });

  describe("Item Transfer", function () {
    const itemData = {
      sku: "TEST-003",
      name: "Transfer Test Item",
      description: "Item for transfer testing",
      category: "Test",
      quantity: 100,
      location: "Warehouse A",
      metadataHash: "QmTransfer123..."
    };

    beforeEach(async function () {
      await inventoryManager.connect(operator).createItem(
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.quantity,
        itemData.location,
        itemData.metadataHash
      );
    });

    it("Should allow operator to transfer items", async function () {
      const transferQuantity = 25;
      const toLocation = "Warehouse B";
      const reason = "Internal transfer";

      const tx = await inventoryManager.connect(operator).transferItem(1, toLocation, transferQuantity, reason);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ItemTransferred");

      expect(event.args.itemId).to.equal(1);
      expect(event.args.fromLocation).to.equal(itemData.location);
      expect(event.args.toLocation).to.equal(toLocation);
      expect(event.args.quantity).to.equal(transferQuantity);

      const item = await inventoryManager.getItem(1);
      expect(item.quantity).to.equal(75); // 100 - 25
    });

    it("Should prevent transfer of insufficient quantity", async function () {
      await expect(
        inventoryManager.connect(operator).transferItem(1, "Warehouse B", 150, "Too much")
      ).to.be.revertedWith("InventoryManager: insufficient quantity");
    });

    it("Should prevent transfer with zero quantity", async function () {
      await expect(
        inventoryManager.connect(operator).transferItem(1, "Warehouse B", 0, "Zero transfer")
      ).to.be.revertedWith("InventoryManager: quantity must be positive");
    });
  });

  describe("Item Deletion", function () {
    const itemData = {
      sku: "TEST-004",
      name: "Delete Test Item",
      description: "Item for deletion testing",
      category: "Test",
      quantity: 30,
      location: "Warehouse C",
      metadataHash: "QmDelete123..."
    };

    beforeEach(async function () {
      await inventoryManager.connect(operator).createItem(
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.quantity,
        itemData.location,
        itemData.metadataHash
      );
    });

    it("Should allow manager to delete items", async function () {
      const reason = "Item discontinued";

      const tx = await inventoryManager.connect(manager).deleteItem(1, reason);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ItemDeleted");

      expect(event.args.itemId).to.equal(1);
      expect(event.args.deleter).to.equal(manager.address);

      const item = await inventoryManager.getItem(1);
      expect(item.isActive).to.equal(false);
    });

    it("Should prevent operator from deleting items", async function () {
      await expect(
        inventoryManager.connect(operator).deleteItem(1, "Test deletion")
      ).to.be.revertedWith("InventoryManager: caller is not manager or admin");
    });
  });

  describe("Batch Operations", function () {
    it("Should allow batch item creation", async function () {
      const items = {
        skus: ["BATCH-001", "BATCH-002"],
        names: ["Batch Item 1", "Batch Item 2"],
        descriptions: ["First batch item", "Second batch item"],
        categories: ["Category 1", "Category 2"],
        quantities: [10, 20],
        locations: ["Location 1", "Location 2"],
        metadataHashes: ["QmBatch1...", "QmBatch2..."]
      };

      const itemIds = await inventoryManager.connect(operator).batchCreateItems(
        items.skus,
        items.names,
        items.descriptions,
        items.categories,
        items.quantities,
        items.locations,
        items.metadataHashes
      );

      expect(itemIds.length).to.equal(2);
      expect(itemIds[0]).to.equal(1);
      expect(itemIds[1]).to.equal(2);

      const item1 = await inventoryManager.getItem(1);
      const item2 = await inventoryManager.getItem(2);

      expect(item1.sku).to.equal("BATCH-001");
      expect(item2.sku).to.equal("BATCH-002");
    });

    it("Should prevent batch creation with mismatched arrays", async function () {
      await expect(
        inventoryManager.connect(operator).batchCreateItems(
          ["BATCH-001"],
          ["Batch Item 1", "Batch Item 2"], // Mismatched length
          ["Desc 1", "Desc 2"],
          ["Cat 1", "Cat 2"],
          [10, 20],
          ["Loc 1", "Loc 2"],
          ["Hash 1", "Hash 2"]
        )
      ).to.be.revertedWith("InventoryManager: array length mismatch");
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      // Create multiple items
      await inventoryManager.connect(operator).createItem("QUERY-001", "Query Item 1", "Desc 1", "Cat 1", 10, "Loc 1", "Hash 1");
      await inventoryManager.connect(operator).createItem("QUERY-002", "Query Item 2", "Desc 2", "Cat 2", 20, "Loc 1", "Hash 2");
      await inventoryManager.connect(operator).createItem("QUERY-003", "Query Item 3", "Desc 3", "Cat 1", 30, "Loc 2", "Hash 3");
    });

    it("Should return all active items", async function () {
      const items = await inventoryManager.getAllActiveItems();
      expect(items.length).to.equal(3);
    });

    it("Should return items by location", async function () {
      const itemsLoc1 = await inventoryManager.getItemsByLocation("Loc 1");
      expect(itemsLoc1.length).to.equal(2);

      const itemsLoc2 = await inventoryManager.getItemsByLocation("Loc 2");
      expect(itemsLoc2.length).to.equal(1);
    });

    it("Should return correct total count", async function () {
      expect(await inventoryManager.getTotalItems()).to.equal(3);
    });

    it("Should return item transactions", async function () {
      // Update an item to create a transaction
      await inventoryManager.connect(operator).updateQuantity(1, 15, "Update test");
      
      const transactions = await inventoryManager.getItemTransactions(1);
      expect(transactions.length).to.be.greaterThan(0);
      expect(transactions[0].action).to.equal("CREATE");
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to pause contract", async function () {
      await inventoryManager.connect(owner).pause();
      expect(await inventoryManager.paused()).to.equal(true);

      await inventoryManager.connect(owner).unpause();
      expect(await inventoryManager.paused()).to.equal(false);
    });

    it("Should prevent non-admin from pausing contract", async function () {
      await expect(
        inventoryManager.connect(manager).pause()
      ).to.be.revertedWith("InventoryManager: caller is not admin");
    });

    it("Should prevent operations when paused", async function () {
      await inventoryManager.connect(owner).pause();

      await expect(
        inventoryManager.connect(operator).createItem(
          "PAUSE-001",
          "Pause Test",
          "Desc",
          "Cat",
          10,
          "Loc",
          "Hash"
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});