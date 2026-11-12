import { getCommerceActor } from "@/app/lib/server/actor";
import { ConsignmentError, consignmentRequest, readConsignment, writeConsignment } from "@/app/lib/server/consignment";

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const actor = await getCommerceActor(request.headers);
  if (!actor?.isOwner || actor.role !== "admin") return reply({ error: "Acesso reservado ao proprietário da loja." }, 403);
  return reply(await readConsignment(actor.organizationId));
}

export async function POST(request: Request) {
  const origin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
  if (request.headers.get("origin") !== origin || request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return reply({ error: "Pedido não autorizado." }, 403);
  }
  const actor = await getCommerceActor(request.headers);
  if (!actor?.isOwner || actor.role !== "admin") return reply({ error: "Acesso reservado ao proprietário da loja." }, 403);
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 64_000) return reply({ error: "O pedido é demasiado longo." }, 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return reply({ error: "Pedido inválido." }, 400); }
  const parsed = consignmentRequest.safeParse(input);
  if (!parsed.success) return reply({ error: "Confira os produtos, as quantidades e os valores preenchidos." }, 400);
  try {
    await writeConsignment(actor, parsed.data);
    return reply({ saved: true });
  } catch (error) {
    if (error instanceof ConsignmentError) return reply({ error: error.message }, 409);
    return reply({ error: "Não foi possível guardar o registo. Tente novamente." }, 500);
  }
}
