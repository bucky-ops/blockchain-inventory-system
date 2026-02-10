exports.up = function (knex) {
  return knex.raw(`
    -- Enable UUID extension for generating unique IDs
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Users table for authentication and role management
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        username VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Inventory items table
    CREATE TABLE inventory_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sku VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        unit_price DECIMAL(10, 2) CHECK (unit_price >= 0),
        supplier VARCHAR(255),
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued', 'out_of_stock')),
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        blockchain_tx_hash VARCHAR(66),
        blockchain_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Inventory movements/transactions table
    CREATE TABLE inventory_movements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
        movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
        quantity INTEGER NOT NULL,
        previous_quantity INTEGER NOT NULL,
        new_quantity INTEGER NOT NULL,
        reason VARCHAR(255),
        reference_number VARCHAR(100),
        performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        blockchain_tx_hash VARCHAR(66),
        blockchain_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit logs table
    CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        blockchain_tx_hash VARCHAR(66),
        blockchain_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- User sessions table for authentication management
    CREATE TABLE user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        wallet_address VARCHAR(42) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- System configuration table
    CREATE TABLE system_config (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        is_encrypted BOOLEAN DEFAULT false,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance optimization
    CREATE INDEX idx_users_wallet_address ON users(wallet_address);
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_username ON users(username);
    CREATE INDEX idx_users_role ON users(role);

    CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
    CREATE INDEX idx_inventory_items_name ON inventory_items(name);
    CREATE INDEX idx_inventory_items_category ON inventory_items(category);
    CREATE INDEX idx_inventory_items_status ON inventory_items(status);
    CREATE INDEX idx_inventory_items_owner_id ON inventory_items(owner_id);

    CREATE INDEX idx_inventory_movements_item_id ON inventory_movements(item_id);
    CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
    CREATE INDEX idx_inventory_movements_performed_by ON inventory_movements(performed_by);
    CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);

    CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
    CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

    CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
    CREATE INDEX idx_user_sessions_wallet_address ON user_sessions(wallet_address);
    CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

    CREATE INDEX idx_system_config_key ON system_config(key);

    -- Trigger function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Triggers for updated_at columns
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = function (knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
    DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
    DROP FUNCTION IF EXISTS update_updated_at_column();
    
    DROP TABLE IF EXISTS system_config;
    DROP TABLE IF EXISTS user_sessions;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS inventory_movements;
    DROP TABLE IF EXISTS inventory_items;
    DROP TABLE IF EXISTS users;
  `);
};
