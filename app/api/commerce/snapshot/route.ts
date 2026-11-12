import { getCommerceActor } from "@/app/lib/server/actor";
import { readCommerceSnapshot } from "@/app/lib/server/commerce-sync";
import { queryOne, type SqlRow } from "@/app/lib/server/db";

export async function GET(request: Request) {
  try {
    const actor = await getCommerceActor(request.headers);
    if (!actor) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Inicie sessão para carregar os dados da loja." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const data = await readCommerceSnapshot(actor.organizationId, actor.role === "collaborator" ? actor.id : null);
    const organization = await queryOne<SqlRow & { name: string; currency_code: string; enabled_modules: typeof actor.enabledModules }>(
      "SELECT name, currency_code, enabled_modules FROM organizations WHERE id = $1 AND status = 'active'",
      [actor.organizationId],
    );
    if (!organization) return Response.json({ error: { code: "STORE_NOT_FOUND", message: "A loja desta conta já não está disponível." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (actor.role !== "admin") {
      data.products = data.products.map((product) => ({ ...product, cost: 0 }));
      data.sales = data.sales.map((sale) => ({
        ...sale,
        items: sale.items.map((line) => ({ ...line, unitCost: 0 })),
      }));
    }

    return Response.json({
      organization: { id: actor.organizationId, name: organization.name, currency: organization.currency_code, enabledModules: organization.enabled_modules },
      profile: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        permissions: actor.permissions,
        organizationId: actor.organizationId,
        enabledModules: actor.enabledModules,
        isOwner: actor.isOwner,
        isPlatformAdmin: actor.isPlatformAdmin,
      },
      data,
      syncedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "SNAPSHOT_FAILED", message: "Não foi possível carregar os dados da loja." } }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
