exports.up = function (knex) {
  return knex.raw(`
    -- Insert default system configuration
    INSERT INTO system_config (key, value, description) VALUES
    ('blockchain_network', 'localhost', 'Blockchain network configuration'),
    ('contract_address_inventory', '', 'Inventory manager contract address'),
    ('contract_address_users', '', 'User registry contract address'),
    ('contract_address_audit', '', 'Audit logger contract address'),
    ('session_timeout_hours', '24', 'User session timeout in hours'),
    ('max_inventory_items', '10000', 'Maximum inventory items per user'),
    ('audit_retention_days', '365', 'Audit log retention period in days');

    -- Create view for inventory summary
    CREATE VIEW inventory_summary AS
    SELECT 
        i.id,
        i.sku,
        i.name,
        i.category,
        i.quantity,
        i.unit_price,
        i.status,
        i.location,
        u.username as owner_name,
        i.created_at,
        i.updated_at,
        COALESCE(m.total_movements, 0) as movement_count
    FROM inventory_items i
    LEFT JOIN users u ON i.owner_id = u.id
    LEFT JOIN (
        SELECT 
            item_id, 
            COUNT(*) as total_movements
        FROM inventory_movements 
        GROUP BY item_id
    ) m ON i.id = m.item_id;

    -- Create view for user activity summary
    CREATE VIEW user_activity_summary AS
    SELECT 
        u.id,
        u.username,
        u.wallet_address,
        u.role,
        u.is_active,
        u.last_login,
        COALESCE(inv.item_count, 0) as inventory_count,
        COALESCE(mov.movement_count, 0) as movement_count,
        COALESCE(audit.action_count, 0) as audit_count,
        COALESCE(sess.session_count, 0) as active_sessions
    FROM users u
    LEFT JOIN (
        SELECT owner_id, COUNT(*) as item_count
        FROM inventory_items
        GROUP BY owner_id
    ) inv ON u.id = inv.owner_id
    LEFT JOIN (
        SELECT performed_by, COUNT(*) as movement_count
        FROM inventory_movements
        GROUP BY performed_by
    ) mov ON u.id = mov.performed_by
    LEFT JOIN (
        SELECT user_id, COUNT(*) as action_count
        FROM audit_logs
        GROUP BY user_id
    ) audit ON u.id = audit.user_id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as session_count
        FROM user_sessions
        WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP
        GROUP BY user_id
    ) sess ON u.id = sess.user_id;
  `);
};

exports.down = function (knex) {
  return knex.raw(`
    DROP VIEW IF EXISTS user_activity_summary;
    DROP VIEW IF EXISTS inventory_summary;
    DELETE FROM system_config WHERE key IN (
      'blockchain_network',
      'contract_address_inventory',
      'contract_address_users',
      'contract_address_audit',
      'session_timeout_hours',
      'max_inventory_items',
      'audit_retention_days'
    );
  `);
};
