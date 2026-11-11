import { z } from "zod";
import { getCommerceActor } from "@/app/lib/server/actor";
import { inTransaction, queryOne, type SqlRow } from "@/app/lib/server/db";

const inputSchema = z.union([z.object({
  storeName: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().min(2).max(100),
}).strict(), z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) }).strict()]);

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
  if (!parsed.success) return Response.json({ error: { message: "Introduza dados válidos para a loja e a conta." } }, { status: 400 });

  const details = parsed.data;
  try {
    const updated = await inTransaction(async (client) => {
      const owner = await queryOne<SqlRow & { id: string }>(
        `SELECT u.id FROM "user" u JOIN organizations o ON o.id = u.organization_id
         WHERE u.id = $1 AND u.organization_id = $2 AND u.is_store_owner IS TRUE
           AND u.store_role = 'admin' AND u.banned IS NOT TRUE AND o.status = 'active' FOR UPDATE OF u, o`,
        [actor.id, actor.organizationId], client,
      );
      if (!owner) return false;
      if ("email" in details) {
        const existing = await queryOne('SELECT id FROM "user" WHERE lower(email) = $1 AND id <> $2', [details.email, actor.id], client);
        if (existing) return "duplicate";
        await client.query('UPDATE "user" SET email = $1, "emailVerified" = false, "updatedAt" = NOW() WHERE id = $2 AND email <> $1', [details.email, actor.id]);
        return true;
      }
      await client.query('UPDATE "user" SET name = $1, "updatedAt" = NOW() WHERE id = $2', [details.ownerName, actor.id]);
      await client.query('UPDATE organizations SET name = $1 WHERE id = $2', [details.storeName, actor.organizationId]);
      return true;
    });
    if (!updated) return Response.json({ error: { message: "O acesso à loja já não está activo." } }, { status: 403 });
    if (updated === "duplicate") return duplicateEmail();
    return Response.json(details, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if ("email" in details && error instanceof Error && "code" in error && error.code === "23505") return duplicateEmail();
    return Response.json({ error: { message: "Não foi possível guardar os dados. Tente novamente." } }, { status: 500 });
  }
}

function duplicateEmail() {
  return Response.json({ error: { message: "Este e-mail já está em uso." } }, { status: 409 });
}
