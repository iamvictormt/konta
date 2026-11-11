import "server-only";

import { auth } from "./auth";
import { queryOne, type SqlRow } from "./db";
import type { StoreModuleId } from "../store-modules";

export type CommerceActor = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "collaborator";
  organizationId: string;
  enabledModules: StoreModuleId[];
  isOwner: boolean;
  isPlatformAdmin: boolean;
};

export function hasPlatformAdministratorRole(role: string | null | undefined) {
  return role?.split(",").includes("platform-admin") ?? false;
}

export async function getStoreActor(headers: Headers): Promise<CommerceActor | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const currentUser = await queryOne<SqlRow & {
    organization_id: string;
    name: string;
    email: string;
    role: string | null;
    store_role: string | null;
    is_store_owner: boolean;
    status: string;
    enabled_modules: StoreModuleId[];
  }>(
    `SELECT u.organization_id, u.name, u.email, u.role, u.store_role, u.is_store_owner,
            o.status, o.enabled_modules
     FROM "user" u
     INNER JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = $1 AND u.banned IS NOT TRUE AND o.status = 'active'`,
    [session.user.id],
  );
  if (!currentUser || (currentUser.store_role !== "admin" && currentUser.store_role !== "collaborator")) return null;

  return {
    id: session.user.id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.store_role === "admin" ? "admin" : "collaborator",
    organizationId: currentUser.organization_id,
    enabledModules: currentUser.enabled_modules,
    isOwner: currentUser.is_store_owner,
    isPlatformAdmin: hasPlatformAdministratorRole(currentUser.role),
  };
}

export async function getCommerceActor(headers: Headers): Promise<CommerceActor | null> {
  const actor = await getStoreActor(headers);
  return actor?.enabledModules.includes("commerce") ? actor : null;
}
