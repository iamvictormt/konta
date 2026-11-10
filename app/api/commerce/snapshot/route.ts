import { getCommerceActor } from "@/app/lib/server/actor";
import { readCommerceSnapshot } from "@/app/lib/server/commerce-sync";

export async function GET(request: Request) {
  try {
    const actor = await getCommerceActor(request.headers);
    if (!actor) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Inicie sessão para carregar os dados da loja." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const data = await readCommerceSnapshot(actor.organizationId);
    if (actor.role !== "admin") {
      data.products = data.products.map((product) => ({ ...product, cost: 0 }));
      data.sales = data.sales.map((sale) => ({
        ...sale,
        items: sale.items.map((line) => ({ ...line, unitCost: 0 })),
      }));
    }

    return Response.json({
      organization: { id: actor.organizationId, name: process.env.KONTA_STORE_NAME ?? "Minha Loja", currency: "Db" },
      profile: { id: actor.id, name: actor.name, email: actor.email, role: actor.role, organizationId: actor.organizationId },
      data,
      syncedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "SNAPSHOT_FAILED", message: "Não foi possível carregar os dados da loja." } }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
