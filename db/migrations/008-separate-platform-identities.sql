ALTER TABLE "user"
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN organization_id DROP DEFAULT;

UPDATE "user"
SET organization_id = NULL
WHERE store_role IS NULL
  AND position('platform-admin' in COALESCE(role, '')) > 0;
