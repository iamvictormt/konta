ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS store_role TEXT,
  ADD COLUMN IF NOT EXISTS is_store_owner BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_store_role_allowed'
  ) THEN
    ALTER TABLE "user"
      ADD CONSTRAINT user_store_role_allowed
      CHECK (store_role IS NULL OR store_role IN ('admin', 'collaborator'));
  END IF;
END $$;

UPDATE "user"
SET store_role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'collaborator' END,
    role = CASE WHEN role = 'admin' THEN 'store-admin' ELSE 'collaborator' END
WHERE organization_id IS NOT NULL
  AND role IN ('admin', 'user')
  AND store_role IS NULL;

WITH candidates AS (
  SELECT id,
         organization_id,
         row_number() OVER (
           PARTITION BY organization_id
           ORDER BY CASE WHEN store_role = 'admin' THEN 0 ELSE 1 END,
                    "createdAt" ASC,
                    id ASC
         ) AS position
  FROM "user" member
  WHERE organization_id IS NOT NULL
    AND store_role IS NOT NULL
    AND banned IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM "user" owner
      WHERE owner.organization_id = member.organization_id
        AND owner.is_store_owner IS TRUE
    )
)
UPDATE "user" member
SET store_role = 'admin',
    role = CASE WHEN member.role = 'collaborator' THEN 'store-admin' ELSE member.role END,
    is_store_owner = TRUE
FROM candidates
WHERE member.id = candidates.id
  AND candidates.position = 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_one_store_owner_per_organization
  ON "user" (organization_id)
  WHERE is_store_owner IS TRUE;

CREATE TABLE IF NOT EXISTS commerce_access_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  target_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('member.promoted', 'member.demoted', 'member.deactivated', 'member.reactivated', 'owner.transferred')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS commerce_access_events_org_created
  ON commerce_access_events (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_support_access_grants (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  granted_by_user_id TEXT NOT NULL REFERENCES "user"(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id TEXT REFERENCES "user"(id),
  CHECK (expires_at > created_at),
  CHECK ((revoked_at IS NULL AND revoked_by_user_id IS NULL) OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS platform_support_access_by_user_org
  ON platform_support_access_grants (granted_by_user_id, organization_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS platform_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  grant_id TEXT REFERENCES platform_support_access_grants(id),
  action TEXT NOT NULL CHECK (action IN ('stores.listed', 'support_access.granted', 'support_access.revoked', 'financial_summary.viewed')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_audit_events_created
  ON platform_audit_events (created_at DESC);
