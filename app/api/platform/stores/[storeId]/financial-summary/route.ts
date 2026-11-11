import { getPlatformActor, writePlatformAudit } from "@/app/lib/server/platform";
import { inTransaction, type SqlRow } from "@/app/lib/server/db";

type RouteContext = { params: Promise<{ storeId: string }> };
type FinancialTotals = SqlRow & {
  sales_total: string | number;
  cost_total: string | number;
  expenses_total: string | number;
  sales_count: string | number;
};

export async function GET(request: Request, { params }: RouteContext) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { storeId } = await params;
  if (!storeId || storeId.length > 160) return Response.json({ error: { code: "INVALID_INPUT", message: "A loja indicada é inválida." } }, { status: 400 });

  const result = await inTransaction(async (client) => {
    const grant = await client.query<SqlRow & { id: string; reason: string; expires_at: Date | string }>(
      `SELECT id, reason, expires_at FROM platform_support_access_grants
       WHERE organization_id = $1
         AND granted_by_user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [storeId, actor.id],
    );
    const activeGrant = grant.rows[0];
    if (!activeGrant) return null;

    await writePlatformAudit(client, actor, "financial_summary.viewed", storeId, activeGrant.id, activeGrant.reason);
    const totals = await client.query<FinancialTotals>(
      `SELECT
         COALESCE((SELECT SUM(total) FROM commerce_sales WHERE organization_id = $1), 0)::bigint AS sales_total,
         COALESCE((SELECT SUM(line.quantity * line.unit_cost)
                   FROM commerce_sale_lines line
                   INNER JOIN commerce_sales sale ON sale.id = line.sale_id
                   WHERE sale.organization_id = $1), 0)::bigint AS cost_total,
         COALESCE((SELECT SUM(amount) FROM commerce_expenses WHERE organization_id = $1), 0)::bigint AS expenses_total,
         (SELECT COUNT(*) FROM commerce_sales WHERE organization_id = $1)::bigint AS sales_count`,
      [storeId],
    );
    return { grantId: activeGrant.id, reason: activeGrant.reason, expiresAt: activeGrant.expires_at, totals: totals.rows[0] };
  });

  if (!result) return Response.json({ error: { code: "SUPPORT_ACCESS_REQUIRED", message: "Abra uma autorização temporária com o motivo do atendimento." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const sales = Number(result.totals.sales_total);
  const costs = Number(result.totals.cost_total);
  const expenses = Number(result.totals.expenses_total);
  const profit = sales - costs - expenses;
  return Response.json({
    summary: {
      sales,
      costs,
      expenses,
      profit,
      margin: sales === 0 ? null : profit / sales * 100,
      salesCount: Number(result.totals.sales_count),
      accessReason: result.reason,
      grantId: result.grantId,
      expiresAt: result.expiresAt,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
