import "server-only";

import { auth } from "./auth";
import { DEFAULT_ORGANIZATION_ID, queryOne, type SqlRow } from "./db";

export type CommerceActor = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "collaborator";
  organizationId: string;
};

export async function getCommerceActor(headers: Headers): Promise<CommerceActor | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const organizationId = session.user.organizationId || DEFAULT_ORGANIZATION_ID;
  const currentUser = await queryOne<SqlRow & { role: string }>(
    'SELECT id, role FROM "user" WHERE id = $1 AND organization_id = $2 AND banned IS NOT TRUE',
    [session.user.id, organizationId],
  );
  if (!currentUser) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: currentUser.role === "admin" ? "admin" : "collaborator",
    organizationId,
  };
}
