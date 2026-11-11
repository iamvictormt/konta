CREATE TABLE IF NOT EXISTS platform_support_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_by_email TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 5 AND 2000),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_support_cases_status_updated
  ON platform_support_cases (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS platform_support_cases_organization_updated
  ON platform_support_cases (organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_support_case_notes (
  id TEXT PRIMARY KEY,
  support_case_id TEXT NOT NULL REFERENCES platform_support_cases(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  author_email TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_support_case_notes_case_created
  ON platform_support_case_notes (support_case_id, created_at ASC);

ALTER TABLE platform_audit_events
  DROP CONSTRAINT IF EXISTS platform_audit_events_action_check;

ALTER TABLE platform_audit_events
  ADD COLUMN IF NOT EXISTS support_case_id TEXT
    REFERENCES platform_support_cases(id) ON DELETE SET NULL;

ALTER TABLE platform_audit_events
  ADD CONSTRAINT platform_audit_events_action_check
  CHECK (action IN (
    'stores.listed',
    'support_access.granted',
    'support_access.revoked',
    'financial_summary.viewed',
    'support_cases.listed',
    'support_case.created',
    'support_case.updated',
    'support_case.note_added'
  ));

CREATE INDEX IF NOT EXISTS platform_audit_events_support_case
  ON platform_audit_events (support_case_id, created_at DESC)
  WHERE support_case_id IS NOT NULL;
