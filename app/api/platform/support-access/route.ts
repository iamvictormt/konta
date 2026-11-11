import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPlatformActor, writePlatformAudit } from "@/app/lib/server/platform";
import { inTransaction, queryOne, type SqlRow } from "@/app/lib/server/db";

const grantSchema = z.object({
  organizationId: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(12).max(500),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});

export async function POST(request: Request) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "O pedido de suporte contém dados inválidos." } }, { status: 400 });
  }
  const parsed = grantSchema.safeParse(rawBody);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", message: "Indique a loja, o motivo do suporte e uma duração de até 60 minutos." } }, { status: 400 });

  const now = new Date();
  const grantId = randomUUID();
  const expiresAt = new Date(now.getTime() + parsed.data.durationMinutes * 60_000);
  const created = await inTransaction(async (client) => {
    const store = await queryOne<SqlRow & { id: string }>(
      "SELECT id FROM organizations WHERE id = $1 FOR UPDATE",
      [parsed.data.organizationId],
      client,
    );
    if (!store) return false;

    await client.query(
      `INSERT INTO platform_support_access_grants
         (id, organization_id, granted_by_user_id, reason, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [grantId, store.id, actor.id, parsed.data.reason, now.toISOString(), expiresAt.toISOString()],
    );
    await writePlatformAudit(client, actor, "support_access.granted", store.id, grantId, parsed.data.reason);
    return true;
  });

  if (!created) return Response.json({ error: { code: "STORE_NOT_FOUND", message: "A loja indicada não existe." } }, { status: 404 });
  return Response.json({ grant: { id: grantId, organizationId: parsed.data.organizationId, reason: parsed.data.reason, expiresAt } }, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
