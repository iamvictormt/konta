import { z } from "zod";
import { getCommerceActor } from "@/app/lib/server/actor";
import { queryOne, type SqlRow } from "@/app/lib/server/db";
import { hasStorePermission } from "@/app/lib/store-permissions";

const periods = z.enum(["7", "30", "365"]);
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const actor = await getCommerceActor(request.headers);
  if (!actor || !hasStorePermission(actor, "revenue:read")) {
    return Response.json({ error: "A sua conta não tem acesso à faturação." }, { status: 403, headers });
  }
  const period = periods.safeParse(new URL(request.url).searchParams.get("days") ?? "30");
  if (!period.success) return Response.json({ error: "Período inválido." }, { status: 400, headers });

  const end = new Date();
  const start = new Date(end.getTime() - Number(period.data) * 86_400_000);
  const row = await queryOne<SqlRow & { sales_count: string; total: string }>(
    `SELECT COUNT(*) AS sales_count, COALESCE(SUM(total), 0) AS total
     FROM commerce_sales WHERE organization_id = $1 AND created_at >= $2 AND created_at <= $3`,
    [actor.organizationId, start.toISOString(), end.toISOString()],
  );
  return Response.json({ total: Number(row?.total ?? 0), salesCount: Number(row?.sales_count ?? 0) }, { headers });
}
