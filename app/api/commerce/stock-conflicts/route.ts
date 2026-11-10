import { z } from "zod";
import { getCommerceActor } from "@/app/lib/server/actor";
import { reconcileStockConflict } from "@/app/lib/server/commerce-sync";

const reconciliationSchema = z.object({
  conflictId: z.string().min(1).max(160),
  countedStock: z.number().int().min(0).max(1_000_000),
});

export async function POST(request: Request) {
  const actor = await getCommerceActor(request.headers);
  if (!actor) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Inicie sessão para continuar." } }, { status: 401 });
  if (actor.role !== "admin") return Response.json({ error: { code: "FORBIDDEN", message: "Apenas o administrador pode reconciliar o stock." } }, { status: 403 });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "O pedido de reconciliação contém dados inválidos." } }, { status: 400 });
  }
  const parsed = reconciliationSchema.safeParse(rawBody);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", message: "Introduza a contagem física do produto em unidades inteiras." } }, { status: 400 });

  try {
    return Response.json({ reconciliation: await reconcileStockConflict(parsed.data.conflictId, parsed.data.countedStock, actor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível reconciliar o stock.";
    if (message === "A divergência de stock não foi encontrada.") {
      return Response.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
    }
    if (message === "Esta divergência já foi reconciliada.") {
      return Response.json({ error: { code: "ALREADY_RESOLVED", message } }, { status: 409 });
    }
    if (message === "O produto desta divergência já não existe.") {
      return Response.json({ error: { code: "PRODUCT_MISSING", message } }, { status: 400 });
    }
    return Response.json({ error: { code: "RECONCILIATION_FAILED", message: "Não foi possível reconciliar o stock." } }, { status: 500 });
  }
}
