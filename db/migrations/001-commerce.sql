CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT,
  currency_code TEXT NOT NULL DEFAULT 'Db',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commerce_products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sku TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL CHECK (price >= 0),
  cost INTEGER NOT NULL CHECK (cost >= 0),
  emoji TEXT NOT NULL DEFAULT '📦',
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS commerce_products_organization_sku_ci_unique
  ON commerce_products (organization_id, lower(sku));

CREATE TABLE IF NOT EXISTS commerce_sales (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  received INTEGER NOT NULL CHECK (received >= 0),
  change_amount INTEGER NOT NULL CHECK (change_amount >= 0)
);

CREATE TABLE IF NOT EXISTS commerce_sale_lines (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES commerce_sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  UNIQUE (sale_id, position)
);

CREATE TABLE IF NOT EXISTS commerce_expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS processed_sync_operations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS stock_conflicts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  sale_id TEXT NOT NULL REFERENCES commerce_sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  quantity_sold INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS commerce_stock_movements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('opening', 'sale', 'adjustment')),
  quantity_delta INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS commerce_sales_org_date
  ON commerce_sales (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_expenses_org_date
  ON commerce_expenses (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_conflicts_open
  ON stock_conflicts (organization_id, resolved_at, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_stock_movements_product_date
  ON commerce_stock_movements (organization_id, product_id, created_at DESC);
