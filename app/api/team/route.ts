import { z } from "zod";
import { auth } from "@/app/lib/server/auth";
import { getCommerceActor } from "@/app/lib/server/actor";
import { queryAll, type SqlRow } from "@/app/lib/server/db";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(254),
  password: z.string().min(12).max(128),
});

type MemberRow = SqlRow & { id: string; name: string; email: string; role: string; createdAt: string };

export async function GET(request: Request) {
  const actor = await getCommerceActor(request.headers);
  if (!actor) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Inicie sessão para continuar." } }, { status: 401 });
  if (actor.role !== "admin") return Response.json({ error: { code: "FORBIDDEN", message: "Apenas administradores podem gerir colaboradores." } }, { status: 403 });

  const members = (await queryAll<MemberRow>(
    'SELECT id, name, email, role, "createdAt" FROM "user" WHERE organization_id = $1 ORDER BY "createdAt"',
    [actor.organizationId],
  )).map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role === "admin" ? "admin" : "collaborator", createdAt: member.createdAt }));
  return Response.json({ members }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await getCommerceActor(request.headers);
  if (!actor) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Inicie sessão para continuar." } }, { status: 401 });
  if (actor.role !== "admin") return Response.json({ error: { code: "FORBIDDEN", message: "Apenas administradores podem criar colaboradores." } }, { status: 403 });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "O formulário contém dados inválidos." } }, { status: 400 });
  }
  const parsed = createUserSchema.safeParse(rawBody);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", message: "Preencha nome, e-mail e uma senha com pelo menos 12 caracteres." } }, { status: 400 });

  try {
    await auth.api.createUser({
      headers: request.headers,
      body: {
        ...parsed.data,
        email: parsed.data.email.toLowerCase(),
        role: "user",
        data: { organizationId: actor.organizationId },
      },
    });
    return Response.json({ created: true }, { status: 201 });
  } catch {
    return Response.json({ error: { code: "USER_CREATE_FAILED", message: "Não foi possível criar o colaborador. Confirme se o e-mail já está em uso." } }, { status: 409 });
  }
}
