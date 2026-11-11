import "server-only";

import { randomUUID } from "node:crypto";
import { auth } from "./auth";
import { execute, queryOne, type SqlExecutor, type SqlRow } from "./db";
import { hasPlatformAdministratorRole } from "./actor";

export type PlatformActor = {
  id: string;
  name: string;
  email: string;
  hasStoreAccess: boolean;
};

export async function getPlatformActor(headers: Headers): Promise<PlatformActor | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const user = await queryOne<SqlRow & { id: string; name: string; email: string; role: string | null; store_role: string | null }>(
    'SELECT id, name, email, role, store_role FROM "user" WHERE id = $1 AND banned IS NOT TRUE',
    [session.user.id],
  );
  if (!user || !hasPlatformAdministratorRole(user.role)) return null;

  return { id: user.id, name: user.name, email: user.email, hasStoreAccess: user.store_role === "admin" || user.store_role === "collaborator" };
}

export async function writePlatformAudit(
  executor: SqlExecutor,
  actor: PlatformActor,
  action: "support_access.granted" | "support_access.revoked" | "financial_summary.viewed",
  organizationId: string | null,
  grantId: string | null,
  reason: string | null,
) {
  await execute(
    `INSERT INTO platform_audit_events
       (id, actor_user_id, actor_email, organization_id, grant_id, action, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [randomUUID(), actor.id, actor.email, organizationId, grantId, action, reason, new Date().toISOString()],
    executor,
  );
}
