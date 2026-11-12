CREATE TABLE commerce_resellers (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX commerce_resellers_org_name
  ON commerce_resellers (organization_id, lower(name));

CREATE TABLE commerce_reseller_deliveries (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  reseller_id text NOT NULL,
  product_id text NOT NULL REFERENCES commerce_products(id),
  product_name text NOT NULL,
  delivered integer NOT NULL CHECK (delivered > 0),
  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0),
  returned integer NOT NULL DEFAULT 0 CHECK (returned >= 0),
  unit_price integer NOT NULL CHECK (unit_price > 0),
  unit_cost integer NOT NULL CHECK (unit_cost >= 0),
  created_at text NOT NULL,
  CHECK (sold + returned <= delivered),
  FOREIGN KEY (organization_id, reseller_id) REFERENCES commerce_resellers(organization_id, id)
);

ALTER TABLE commerce_sales
  ADD COLUMN reseller_id text,
  ADD COLUMN consignment_period text,
  ADD FOREIGN KEY (organization_id, reseller_id) REFERENCES commerce_resellers(organization_id, id);

CREATE TABLE commerce_reseller_receipts (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  reseller_id text NOT NULL,
  actor_user_id text NOT NULL,
  sale_id text REFERENCES commerce_sales(id),
  cash_session_id text REFERENCES commerce_cash_sessions(id),
  amount integer NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('cash', 'transfer')),
  created_at text NOT NULL,
  CHECK ((method = 'cash') = (cash_session_id IS NOT NULL)),
  FOREIGN KEY (organization_id, reseller_id) REFERENCES commerce_resellers(organization_id, id)
);

CREATE TABLE commerce_consignment_requests (
  organization_id text NOT NULL REFERENCES organizations(id),
  id text NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE INDEX commerce_reseller_deliveries_org ON commerce_reseller_deliveries (organization_id, reseller_id);
CREATE INDEX commerce_reseller_sales_org ON commerce_sales (organization_id, reseller_id) WHERE reseller_id IS NOT NULL;
CREATE INDEX commerce_reseller_receipts_org ON commerce_reseller_receipts (organization_id, reseller_id);
CREATE INDEX commerce_reseller_receipts_cash ON commerce_reseller_receipts (cash_session_id) WHERE cash_session_id IS NOT NULL;
