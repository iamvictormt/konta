DROP INDEX IF EXISTS user_one_store_access_per_organization;

CREATE INDEX IF NOT EXISTS user_store_team_by_organization
  ON "user" (organization_id)
  WHERE store_role = 'collaborator';

CREATE INDEX IF NOT EXISTS commerce_sales_by_actor
  ON commerce_sales (organization_id, actor_user_id);

CREATE INDEX IF NOT EXISTS commerce_expenses_by_actor
  ON commerce_expenses (organization_id, actor_user_id);

CREATE INDEX IF NOT EXISTS commerce_cash_sessions_by_opener
  ON commerce_cash_sessions (organization_id, opened_by);
