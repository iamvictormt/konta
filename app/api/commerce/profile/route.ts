import { getStoreActor } from "@/app/lib/server/actor";
import { queryOne, type SqlRow } from "@/app/lib/server/db";
import type { StoreModuleId } from "@/app/lib/store-modules";

export async function GET(request: Request) {
  const actor = await getStoreActor(request.headers);
  if (!actor) {
    return Response.json({ error: { code: "STORE_ACCESS_REQUIRED", message: "Esta conta não tem acesso a uma loja." } }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const organization = await queryOne<SqlRow & { name: string; currency_code: string; enabled_modules: StoreModuleId[] }>(
    "SELECT name, currency_code, enabled_modules FROM organizations WHERE id = $1 AND status = 'active'",
    [actor.organizationId],
  );
  if (!organization) {
    return Response.json({ error: { code: "STORE_NOT_FOUND", message: "A loja desta conta já não está disponível." } }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json({
    profile: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      permissions: actor.permissions,
      organizationId: actor.organizationId,
      enabledModules: organization.enabled_modules,
      isOwner: actor.isOwner,
      isPlatformAdmin: actor.isPlatformAdmin,
    },
    organization: { id: actor.organizationId, name: organization.name, currency: organization.currency_code, enabledModules: organization.enabled_modules },
  }, { headers: { "Cache-Control": "no-store" } });
}
