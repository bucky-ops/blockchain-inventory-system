const { v4: uuidv4 } = require("uuid");

exports.seed = async function (knex) {
  // Clear existing data
  await knex("audit_logs").del();
  await knex("inventory_movements").del();
  await knex("user_sessions").del();
  await knex("inventory_items").del();
  await knex("users").del();

  // Insert sample users
  const users = await knex("users")
    .insert([
      {
        id: uuidv4(),
        wallet_address: "0x1234567890123456789012345678901234567890",
        email: "admin@blockchain-inventory.com",
        username: "admin",
        role: "admin",
        is_active: true,
        last_login: new Date(),
      },
      {
        id: uuidv4(),
        wallet_address: "0x2345678901234567890123456789012345678901",
        email: "manager@blockchain-inventory.com",
        username: "manager",
        role: "manager",
        is_active: true,
        last_login: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: uuidv4(),
        wallet_address: "0x3456789012345678901234567890123456789012",
        email: "user1@blockchain-inventory.com",
        username: "user1",
        role: "user",
        is_active: true,
        last_login: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: uuidv4(),
        wallet_address: "0x4567890123456789012345678901234567890123",
        email: "viewer@blockchain-inventory.com",
        username: "viewer",
        role: "viewer",
        is_active: true,
        last_login: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
    ])
    .returning("*");

  // Insert sample inventory items
  const inventoryItems = await knex("inventory_items")
    .insert([
      {
        id: uuidv4(),
        sku: "LAPTOP-001",
        name: "Business Laptop Pro",
        description: "High-performance laptop for business use",
        category: "Electronics",
        quantity: 50,
        unit_price: 1299.99,
        supplier: "TechSupplier Inc.",
        location: "Warehouse A - Shelf 1",
        status: "active",
        owner_id: users[1].id, // manager
        blockchain_tx_hash:
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "MOUSE-002",
        name: "Wireless Optical Mouse",
        description: "Ergonomic wireless mouse",
        category: "Electronics",
        quantity: 200,
        unit_price: 29.99,
        supplier: "Peripheral Co.",
        location: "Warehouse B - Shelf 3",
        status: "active",
        owner_id: users[2].id, // user1
        blockchain_tx_hash:
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "KEYBOARD-003",
        name: "Mechanical Keyboard",
        description: "RGB mechanical keyboard",
        category: "Electronics",
        quantity: 75,
        unit_price: 89.99,
        supplier: "Peripheral Co.",
        location: "Warehouse A - Shelf 2",
        status: "active",
        owner_id: users[2].id, // user1
        blockchain_tx_hash:
          "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "MONITOR-004",
        name: '27" 4K Monitor',
        description: "Ultra HD 27-inch monitor",
        category: "Electronics",
        quantity: 25,
        unit_price: 449.99,
        supplier: "DisplayTech Ltd.",
        location: "Warehouse C - Shelf 1",
        status: "active",
        owner_id: users[1].id, // manager
        blockchain_tx_hash:
          "0x5678901234567890567890123456789056789012345678905678901234567890",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "DESK-005",
        name: "Standing Desk",
        description: "Adjustable height standing desk",
        category: "Furniture",
        quantity: 15,
        unit_price: 599.99,
        supplier: "OfficeFurniture Co.",
        location: "Warehouse D - Shelf 5",
        status: "active",
        owner_id: users[0].id, // admin
        blockchain_tx_hash:
          "0x9012345678909012345678909012345678909012345678909012345678909012",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "CHAIR-006",
        name: "Ergonomic Office Chair",
        description: "High-back ergonomic chair",
        category: "Furniture",
        quantity: 30,
        unit_price: 349.99,
        supplier: "OfficeFurniture Co.",
        location: "Warehouse D - Shelf 6",
        status: "active",
        owner_id: users[0].id, // admin
        blockchain_tx_hash:
          "0x3456789034567890345678903456789034567890345678903456789034567890",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "PRINTER-007",
        name: "Laser Printer",
        description: "Monochrome laser printer",
        category: "Electronics",
        quantity: 0,
        unit_price: 299.99,
        supplier: "PrintTech Inc.",
        location: "Warehouse B - Shelf 4",
        status: "out_of_stock",
        owner_id: users[1].id, // manager
        blockchain_tx_hash:
          "0x7890123478901234789012347890123478901234789012347890123478901234",
        blockchain_timestamp: new Date(),
      },
      {
        id: uuidv4(),
        sku: "TABLET-008",
        name: '10" Tablet',
        description: "10-inch Android tablet",
        category: "Electronics",
        quantity: 40,
        unit_price: 199.99,
        supplier: "MobileTech Ltd.",
        location: "Warehouse A - Shelf 5",
        status: "active",
        owner_id: users[2].id, // user1
        blockchain_tx_hash:
          "0x2345678923456789234567892345678923456789234567892345678923456789",
        blockchain_timestamp: new Date(),
      },
    ])
    .returning("*");

  // Insert sample inventory movements
  await knex("inventory_movements").insert([
    {
      id: uuidv4(),
      item_id: inventoryItems[0].id, // LAPTOP-001
      movement_type: "in",
      quantity: 50,
      previous_quantity: 0,
      new_quantity: 50,
      reason: "Initial stock",
      reference_number: "PO-2024-001",
      performed_by: users[1].id, // manager
      blockchain_tx_hash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      blockchain_timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      id: uuidv4(),
      item_id: inventoryItems[1].id, // MOUSE-002
      movement_type: "in",
      quantity: 200,
      previous_quantity: 0,
      new_quantity: 200,
      reason: "Initial stock",
      reference_number: "PO-2024-002",
      performed_by: users[2].id, // user1
      blockchain_tx_hash:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      blockchain_timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    },
    {
      id: uuidv4(),
      item_id: inventoryItems[0].id, // LAPTOP-001
      movement_type: "out",
      quantity: 5,
      previous_quantity: 50,
      new_quantity: 45,
      reason: "Sales order",
      reference_number: "SO-2024-015",
      performed_by: users[1].id, // manager
      blockchain_tx_hash:
        "0x3333333333333333333333333333333333333333333333333333333333333333",
      blockchain_timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      id: uuidv4(),
      item_id: inventoryItems[0].id, // LAPTOP-001
      movement_type: "adjustment",
      quantity: 5,
      previous_quantity: 45,
      new_quantity: 50,
      reason: "Stock correction",
      reference_number: "ADJ-2024-003",
      performed_by: users[0].id, // admin
      blockchain_tx_hash:
        "0x4444444444444444444444444444444444444444444444444444444444444444",
      blockchain_timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      id: uuidv4(),
      item_id: inventoryItems[6].id, // PRINTER-007
      movement_type: "out",
      quantity: 10,
      previous_quantity: 10,
      new_quantity: 0,
      reason: "Bulk order",
      reference_number: "SO-2024-020",
      performed_by: users[1].id, // manager
      blockchain_tx_hash:
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      blockchain_timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    },
  ]);

  // Insert sample audit logs
  await knex("audit_logs").insert([
    {
      id: uuidv4(),
      user_id: users[0].id, // admin
      action: "CREATE",
      resource_type: "user",
      resource_id: users[1].id,
      old_values: null,
      new_values: {
        username: "manager",
        role: "manager",
        wallet_address: users[1].wallet_address,
      },
      ip_address: "192.168.1.100",
      user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      blockchain_tx_hash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      blockchain_timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: uuidv4(),
      user_id: users[1].id, // manager
      action: "CREATE",
      resource_type: "inventory_item",
      resource_id: inventoryItems[0].id,
      old_values: null,
      new_values: {
        sku: "LAPTOP-001",
        name: "Business Laptop Pro",
        quantity: 50,
      },
      ip_address: "192.168.1.101",
      user_agent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      blockchain_tx_hash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockchain_timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: uuidv4(),
      user_id: users[1].id, // manager
      action: "UPDATE",
      resource_type: "inventory_item",
      resource_id: inventoryItems[0].id,
      old_values: { quantity: 50 },
      new_values: { quantity: 45 },
      ip_address: "192.168.1.101",
      user_agent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      blockchain_tx_hash:
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      blockchain_timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: uuidv4(),
      user_id: users[2].id, // user1
      action: "LOGIN",
      resource_type: "session",
      resource_id: null,
      old_values: null,
      new_values: { wallet_address: users[2].wallet_address },
      ip_address: "192.168.1.102",
      user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      blockchain_tx_hash:
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      blockchain_timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: uuidv4(),
      user_id: users[0].id, // admin
      action: "ADJUSTMENT",
      resource_type: "inventory_item",
      resource_id: inventoryItems[0].id,
      old_values: { quantity: 45 },
      new_values: { quantity: 50 },
      ip_address: "192.168.1.100",
      user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      blockchain_tx_hash:
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      blockchain_timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ]);

  // Insert sample user sessions
  await knex("user_sessions").insert([
    {
      id: uuidv4(),
      user_id: users[0].id, // admin
      session_token: "admin-session-token-" + Date.now(),
      wallet_address: users[0].wallet_address,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      is_active: true,
      ip_address: "192.168.1.100",
      user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    {
      id: uuidv4(),
      user_id: users[2].id, // user1
      session_token: "user1-session-token-" + Date.now(),
      wallet_address: users[2].wallet_address,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      is_active: true,
      ip_address: "192.168.1.102",
      user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    },
  ]);

  console.log("✅ Database seeded successfully with sample data");
  console.log(`📊 Created ${users.length} users`);
  console.log(`📦 Created ${inventoryItems.length} inventory items`);
  console.log(`📝 Created 5 inventory movements`);
  console.log(`🔍 Created 5 audit logs`);
  console.log(`🔐 Created 2 active sessions`);
};
