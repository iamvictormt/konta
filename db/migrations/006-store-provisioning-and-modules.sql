ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['commerce']::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_status_allowed'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_status_allowed
      CHECK (status IN ('active', 'inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_modules_allowed'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_modules_allowed
      CHECK (
        cardinality(enabled_modules) >= 1
        AND enabled_modules <@ ARRAY['commerce', 'services', 'training']::TEXT[]
      );
  END IF;
END $$;

WITH ranked_store_users AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id
           ORDER BY CASE WHEN is_store_owner IS TRUE THEN 0 ELSE 1 END,
                    CASE WHEN store_role = 'admin' THEN 0 ELSE 1 END,
                    CASE WHEN banned IS NOT TRUE THEN 0 ELSE 1 END,
                    "createdAt" ASC,
                    id ASC
         ) AS position
  FROM "user"
  WHERE organization_id IS NOT NULL AND store_role IS NOT NULL
), removed_store_users AS (
  SELECT id FROM ranked_store_users WHERE position > 1
)
DELETE FROM "session" session
USING removed_store_users removed
WHERE session."userId" = removed.id;

WITH ranked_store_users AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id
           ORDER BY CASE WHEN is_store_owner IS TRUE THEN 0 ELSE 1 END,
                    CASE WHEN store_role = 'admin' THEN 0 ELSE 1 END,
                    CASE WHEN banned IS NOT TRUE THEN 0 ELSE 1 END,
                    "createdAt" ASC,
                    id ASC
         ) AS position
  FROM "user"
  WHERE organization_id IS NOT NULL AND store_role IS NOT NULL
)
UPDATE "user" member
SET store_role = NULL,
    role = NULLIF((
      SELECT string_agg(role_name, ',')
      FROM unnest(string_to_array(COALESCE(member.role, ''), ',')) AS role_name
      WHERE role_name NOT IN ('store-admin', 'collaborator')
    ), '')
FROM ranked_store_users ranked
WHERE member.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_one_store_access_per_organization
  ON "user" (organization_id)
  WHERE organization_id IS NOT NULL AND store_role IS NOT NULL;

ALTER TABLE processed_sync_operations
  DROP CONSTRAINT IF EXISTS processed_sync_operations_pkey;

ALTER TABLE processed_sync_operations
  ADD CONSTRAINT processed_sync_operations_pkey PRIMARY KEY (organization_id, id);
