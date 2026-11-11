import { z } from "zod";
import { getCommerceActor } from "@/app/lib/server/actor";
import { inTransaction, queryOne, type SqlRow } from "@/app/lib/server/db";

const inputSchema = z.object({
  storeName: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().min(2).max(100),
}).strict();

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  const trustedOrigin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
  if (origin !== trustedOrigin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: { message: "Pedido não autorizado." } }, { status: 403 });
  }
  const actor = await getCommerceActor(request.headers);
  if (!actor || !actor.isOwner || actor.role !== "admin") {
    return Response.json({ error: { message: "Apenas o proprietário pode alterar estes dados." } }, { status: 403 });
  }

  let input: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 4096) return Response.json({ error: { message: "Dados demasiado longos." } }, { status: 413 });
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: { message: "Dados inválidos." } }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: { message: "Introduza nomes válidos para a loja e o proprietário." } }, { status: 400 });

  try {
    const updated = await inTransaction(async (client) => {
      const owner = await queryOne<SqlRow & { id: string }>(
        `SELECT u.id FROM "user" u JOIN organizations o ON o.id = u.organization_id
         WHERE u.id = $1 AND u.organization_id = $2 AND u.is_store_owner IS TRUE
           AND u.store_role = 'admin' AND u.banned IS NOT TRUE AND o.status = 'active' FOR UPDATE OF u, o`,
        [actor.id, actor.organizationId], client,
      );
      if (!owner) return false;
      await client.query('UPDATE "user" SET name = $1, "updatedAt" = NOW() WHERE id = $2', [parsed.data.ownerName, actor.id]);
      await client.query('UPDATE organizations SET name = $1 WHERE id = $2', [parsed.data.storeName, actor.organizationId]);
      return true;
    });
    if (!updated) return Response.json({ error: { message: "O acesso à loja já não está activo." } }, { status: 403 });
    return Response.json({ storeName: parsed.data.storeName, ownerName: parsed.data.ownerName }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { message: "Não foi possível guardar os dados. Tente novamente." } }, { status: 500 });
  }
}
