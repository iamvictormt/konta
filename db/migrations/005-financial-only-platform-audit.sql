DELETE FROM platform_audit_events
WHERE action NOT IN (
  'support_access.granted',
  'support_access.revoked',
  'financial_summary.viewed'
);

ALTER TABLE platform_audit_events
  DROP CONSTRAINT IF EXISTS platform_audit_events_action_check;

ALTER TABLE platform_audit_events
  DROP COLUMN IF EXISTS support_case_id;

ALTER TABLE platform_audit_events
  ADD CONSTRAINT platform_audit_events_action_check
  CHECK (action IN (
    'support_access.granted',
    'support_access.revoked',
    'financial_summary.viewed'
  ));
