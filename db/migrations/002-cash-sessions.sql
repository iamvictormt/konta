CREATE TABLE IF NOT EXISTS commerce_cash_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  device_id TEXT NOT NULL,
  opened_by TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  opening_amount BIGINT NOT NULL CHECK (opening_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  closed_by TEXT,
  closed_at TEXT,
  expected_amount BIGINT,
  counted_amount BIGINT CHECK (counted_amount >= 0),
  difference_amount BIGINT,
  CHECK (
    (status = 'open' AND closed_by IS NULL AND closed_at IS NULL AND expected_amount IS NULL AND counted_amount IS NULL AND difference_amount IS NULL)
    OR
    (status = 'closed' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND expected_amount IS NOT NULL AND counted_amount IS NOT NULL AND difference_amount IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS commerce_cash_sessions_one_open_per_device
  ON commerce_cash_sessions (organization_id, device_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS commerce_cash_sessions_org_opened
  ON commerce_cash_sessions (organization_id, opened_at DESC);

ALTER TABLE commerce_sales
  ADD COLUMN IF NOT EXISTS cash_session_id TEXT REFERENCES commerce_cash_sessions(id);

ALTER TABLE commerce_expenses
  ADD COLUMN IF NOT EXISTS cash_session_id TEXT REFERENCES commerce_cash_sessions(id);

CREATE INDEX IF NOT EXISTS commerce_sales_cash_session
  ON commerce_sales (cash_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commerce_expenses_cash_session
  ON commerce_expenses (cash_session_id, created_at DESC);
