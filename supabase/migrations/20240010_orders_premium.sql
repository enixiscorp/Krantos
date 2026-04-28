-- =============================================================================
-- Migration: Premium Orders System (orders, items, history, notifications)
-- Stack: Supabase Postgres + RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Enum types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_notification_type_enum AS ENUM ('order_created', 'order_status_changed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_notification_status_enum AS ENUM ('unread', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name      varchar(200) NOT NULL,
  client_phone     varchar(30),
  client_email     varchar(200),
  client_location  varchar(200),
  amount_total     decimal(12,2) NOT NULL DEFAULT 0,
  currency         varchar(10) NOT NULL DEFAULT 'XOF',
  status           order_status_enum NOT NULL DEFAULT 'pending',
  notes            text,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name  varchar(200) NOT NULL,
  quantity      integer NOT NULL CHECK (quantity >= 1),
  price         decimal(12,2) NOT NULL DEFAULT 0,
  created_at    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status  order_status_enum,
  new_status  order_status_enum NOT NULL,
  changed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at  timestamp with time zone NOT NULL DEFAULT now(),
  reason      text
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        admin_notification_type_enum NOT NULL,
  status      admin_notification_status_enum NOT NULL DEFAULT 'unread',
  title       varchar(200) NOT NULL,
  message     text,
  order_id    uuid REFERENCES orders(id) ON DELETE CASCADE,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Trigger: keep orders.updated_at fresh
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON orders;
CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Trigger: history line on status change
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history(order_id, old_status, new_status, changed_by, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), now());

    INSERT INTO admin_notifications(type, status, title, message, order_id, created_at)
    VALUES (
      'order_status_changed',
      'unread',
      'Statut commande mis à jour',
      CONCAT('Commande ', NEW.id, ' : ', OLD.status, ' → ', NEW.status),
      NEW.id,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_orders_status_history ON orders;
CREATE TRIGGER trg_orders_status_history
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();

-- ---------------------------------------------------------------------------
-- 5) View: orders_with_details
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW orders_with_details AS
SELECT
  o.*,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'price', oi.price,
          'created_at', oi.created_at
        )
        ORDER BY oi.created_at ASC
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    ),
    '[]'::jsonb
  ) AS items,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'old_status', h.old_status,
          'new_status', h.new_status,
          'changed_by', h.changed_by,
          'changed_at', h.changed_at,
          'reason', h.reason
        )
        ORDER BY h.changed_at DESC
      )
      FROM order_status_history h
      WHERE h.order_id = o.id
    ),
    '[]'::jsonb
  ) AS status_history
FROM orders o;

-- ---------------------------------------------------------------------------
-- 6) RLS
-- Policy: seuls les admins (admin_users) + super_admin (profiles) peuvent gérer
-- ---------------------------------------------------------------------------

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Helper predicate via SQL: is current user admin staff?
-- (Using EXISTS on admin_users, plus profiles super_admin)

DROP POLICY IF EXISTS orders_admin_all ON orders;
CREATE POLICY orders_admin_all
  ON orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS order_items_admin_all ON order_items;
CREATE POLICY order_items_admin_all
  ON order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS order_status_history_admin_read ON order_status_history;
CREATE POLICY order_status_history_admin_read
  ON order_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS order_status_history_service_write ON order_status_history;
CREATE POLICY order_status_history_service_write
  ON order_status_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS admin_notifications_admin_read ON admin_notifications;
CREATE POLICY admin_notifications_admin_read
  ON admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS admin_notifications_service_write ON admin_notifications;
CREATE POLICY admin_notifications_service_write
  ON admin_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

