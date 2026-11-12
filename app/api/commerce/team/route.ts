import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/app/lib/password-policy";
import { STORE_PERMISSIONS, type StorePermission } from "@/app/lib/store-permissions";
import { getCommerceActor, type CommerceActor } from "@/app/lib/server/actor";
import { execute, inTransaction, queryAll, queryOne, type SqlExecutor, type SqlRow } from "@/app/lib/server/db";

const employeeBanReason = "konta:store-owner-disabled-employee";
const createEmployee = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});
const employeeId = z.string().min(1).max(160);
const changeEmployee = z.union([
  z.strictObject({ id: employeeId, active: z.boolean() }),
  z.strictObject({ id: employeeId, permissions: z.array(z.enum(STORE_PERMISSIONS)).max(STORE_PERMISSIONS.length) }),
]);

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function forbidden() {
  return reply({ error: { message: "A gestão da equipa é reservada ao proprietário da loja." } }, 403);
}

async function getOwner(request: Request) {
  if (request.method !== "GET") {
    const trustedOrigin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
    const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (request.headers.get("origin") !== trustedOrigin || contentType !== "application/json") return null;
  }
  const actor = await getCommerceActor(request.headers);
  return actor?.isOwner && actor.role === "admin" ? actor : null;
}

async function readInput(request: Request): Promise<unknown> {
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 4096) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function ownerStillAuthorized(actor: CommerceActor, client: SqlExecutor) {
  const store = await queryOne<SqlRow>(
    "SELECT id FROM organizations WHERE id = $1 AND status = 'active' AND 'commerce' = ANY(enabled_modules) FOR SHARE",
    [actor.organizationId], client,
  );
  if (!store) return false;
  return Boolean(await queryOne<SqlRow>(
    `SELECT id FROM "user" WHERE id = $1 AND organization_id = $2
     AND is_store_owner IS TRUE AND store_role = 'admin' AND banned IS NOT TRUE FOR SHARE`,
    [actor.id, actor.organizationId], client,
  ));
}

export async function GET(request: Request) {
  const actor = await getOwner(request);
  if (!actor) return forbidden();
  const employees = await queryAll<SqlRow & { id: string; name: string; email: string; active: boolean; permissions: StorePermission[] }>(
    `SELECT id, name, email, banned IS NOT TRUE AS active, store_permissions AS permissions
     FROM "user" WHERE organization_id = $1 AND store_role = 'collaborator' AND role = 'collaborator'
     AND is_store_owner IS NOT TRUE ORDER BY lower(name), id`,
    [actor.organizationId],
  );
  return reply({ employees });
}

export async function POST(request: Request) {
  const actor = await getOwner(request);
  if (!actor) return forbidden();
  const parsed = createEmployee.safeParse(await readInput(request));
  if (!parsed.success) return reply({ error: { message: "Confira o nome, o e-mail e a palavra-passe." } }, 400);
  const { name, email, password } = parsed.data;
  const id = randomUUID();

  try {
    const hash = await hashPassword(password);
    const status = await inTransaction(async (client) => {
      if (!await ownerStillAuthorized(actor, client)) return 403;
      if (await queryOne<SqlRow>('SELECT id FROM "user" WHERE lower(email) = $1', [email], client)) return 409;
      await execute(
        `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned, organization_id, store_role, is_store_owner)
         VALUES ($1, $2, $3, FALSE, now(), now(), 'collaborator', FALSE, $4, 'collaborator', FALSE)`,
        [id, name, email, actor.organizationId], client,
      );
      await execute(
        `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
        [randomUUID(), id, hash], client,
      );
      return 201;
    });
    if (status === 403) return forbidden();
    if (status === 201) return reply({ employee: { id, name, email, active: true, permissions: [] } }, 201);
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") {
      return reply({ error: { message: "Não foi possível criar a conta. Tente novamente." } }, 500);
    }
  }
  return reply({ error: { message: "Este e-mail já está associado a outra conta." } }, 409);
}

export async function PATCH(request: Request) {
  const actor = await getOwner(request);
  if (!actor) return forbidden();
  const parsed = changeEmployee.safeParse(await readInput(request));
  if (!parsed.success) return reply({ error: { message: "A alteração da conta não é válida." } }, 400);
  const { id } = parsed.data;

  const status = await inTransaction(async (client) => {
    if (!await ownerStillAuthorized(actor, client)) return 403;
    const employee = await queryOne<SqlRow & { banned: boolean | null; banReason: string | null }>(
      `SELECT banned, "banReason" FROM "user" WHERE id = $1 AND organization_id = $2
       AND store_role = 'collaborator' AND role = 'collaborator' AND is_store_owner IS NOT TRUE FOR UPDATE`,
      [id, actor.organizationId], client,
    );
    if (!employee) return 404;
    if ("permissions" in parsed.data) {
      await execute('UPDATE "user" SET store_permissions = $1, "updatedAt" = now() WHERE id = $2',
        [[...new Set(parsed.data.permissions)], id], client);
      return 200;
    }
    if (employee.banned && employee.banReason !== employeeBanReason) return 409;
    const { active } = parsed.data;
    await execute(
      'UPDATE "user" SET banned = $1, "banReason" = $2, "banExpires" = NULL, "updatedAt" = now() WHERE id = $3',
      [!active, active ? null : employeeBanReason, id], client,
    );
    if (!active) await execute('DELETE FROM "session" WHERE "userId" = $1', [id], client);
    return 200;
  });
  if (status === 403) return forbidden();
  if (status === 404) return reply({ error: { message: "Funcionário não encontrado nesta loja." } }, 404);
  if (status === 409) return reply({ error: { message: "Esta conta foi suspensa pela administração da Kontá." } }, 409);
  return reply("permissions" in parsed.data
    ? { id, permissions: [...new Set(parsed.data.permissions)] }
    : { id, active: parsed.data.active });
}
