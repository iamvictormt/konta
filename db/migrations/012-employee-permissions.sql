ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS store_permissions text[] NOT NULL DEFAULT '{}';

ALTER TABLE "user"
  ADD CONSTRAINT user_store_permissions_supported
  CHECK (store_permissions <@ ARRAY['products:write', 'revenue:read']::text[]);
