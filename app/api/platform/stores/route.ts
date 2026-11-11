import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/app/lib/server/auth";
import { getPlatformActor } from "@/app/lib/server/platform";
import { execute, inTransaction, queryAll, queryOne, type SqlRow } from "@/app/lib/server/db";
import { hasPlatformAdministratorRole } from "@/app/lib/server/actor";
import { STORE_MODULE_IDS, type StoreModuleId } from "@/app/lib/store-modules";

const createStoreSchema = z.object({
  storeName: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().min(2).max(100),
  ownerEmail: z.email().trim().max(254),
  initialPassword: z.string().min(12).max(128),
  enabledModules: z.array(z.enum(STORE_MODULE_IDS)).min(1).max(STORE_MODULE_IDS.length)
    .refine((modules) => new Set(modules).size === modules.length),
});

const statusSchema = z.object({
  storeId: z.string().trim().min(1).max(160),
  active: z.boolean(),
});

type StoreRow = SqlRow & {
  id: string;
  name: string;
  country_code: string | null;
  currency_code: string;
  created_at: string;
  status: "active" | "inactive";
  enabled_modules: StoreModuleId[];
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_created_at: string | null;
  owner_banned: boolean | null;
  support_grant_id: string | null;
  support_reason: string | null;
  support_expires_at: Date | string | null;
  last_sync_at: string | null;
};

const PLATFORM_DEACTIVATION_REASON = "Acesso à loja desactivado pelo administrador da plataforma.";

export async function GET(request: Request) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const stores = await queryAll<StoreRow>(
    `SELECT o.id, o.name, o.country_code, o.currency_code, o.created_at,
            o.status, o.enabled_modules,
            owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
            owner."createdAt" AS owner_created_at, owner.banned AS owner_banned,
            support.id AS support_grant_id,
            support.reason AS support_reason,
            support.expires_at AS support_expires_at,
            (SELECT MAX(operation.received_at)
             FROM processed_sync_operations operation
             WHERE operation.organization_id = o.id) AS last_sync_at
     FROM organizations o
     LEFT JOIN "user" owner ON owner.organization_id = o.id AND owner.is_store_owner IS TRUE
     LEFT JOIN LATERAL (
       SELECT grant_row.id, grant_row.reason, grant_row.expires_at
       FROM platform_support_access_grants grant_row
       WHERE grant_row.organization_id = o.id
         AND grant_row.granted_by_user_id = $1
         AND grant_row.revoked_at IS NULL
         AND grant_row.expires_at > NOW()
       ORDER BY grant_row.created_at DESC
       LIMIT 1
     ) support ON TRUE
     ORDER BY o.created_at DESC, lower(o.name), o.id`,
    [actor.id],
  );

  return Response.json({ stores: stores.map((store) => ({
    id: store.id,
    name: store.name,
    countryCode: store.country_code,
    currency: store.currency_code,
    createdAt: store.created_at,
    status: store.status,
    enabledModules: store.enabled_modules,
    owner: store.owner_id && store.owner_name && store.owner_email ? {
      id: store.owner_id,
      name: store.owner_name,
      email: store.owner_email,
      createdAt: store.owner_created_at,
      active: store.status === "active" && store.owner_banned !== true,
    } : null,
    lastSyncAt: store.last_sync_at,
    supportAccess: store.support_grant_id ? {
      id: store.support_grant_id,
      reason: store.support_reason,
      expiresAt: store.support_expires_at,
    } : null,
  })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });

  let input: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 16_384) {
      return Response.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "O formulário excede o limite permitido." } }, { status: 413 });
    }
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "O formulário contém dados inválidos." } }, { status: 400 });
  }

  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", message: "Preencha os dados da loja e do proprietário e escolha pelo menos um módulo." } }, { status: 400 });

  const ownerEmail = parsed.data.ownerEmail.toLowerCase();
  const existingUser = await queryOne<SqlRow & { id: string }>(
    'SELECT id FROM "user" WHERE lower(email) = $1',
    [ownerEmail],
  );
  if (existingUser) return Response.json({ error: { code: "EMAIL_IN_USE", message: "Este e-mail já está associado a outra conta." } }, { status: 409 });

  const storeId = randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await execute(
      `INSERT INTO organizations (id, name, currency_code, created_at, status, enabled_modules)
       VALUES ($1, $2, 'Db', $3, 'active', $4::TEXT[])`,
      [storeId, parsed.data.storeName, createdAt, parsed.data.enabledModules],
    );

    await auth.api.createUser({
      body: {
        name: parsed.data.ownerName,
        email: ownerEmail,
        password: parsed.data.initialPassword,
        role: "store-admin",
        data: {
          organizationId: storeId,
          storeRole: "admin",
          isStoreOwner: true,
        },
      },
    });

    return Response.json({
      store: {
        id: storeId,
        name: parsed.data.storeName,
        createdAt,
        status: "active" as const,
        enabledModules: parsed.data.enabledModules,
        owner: { name: parsed.data.ownerName, email: ownerEmail, active: true },
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    try {
      await inTransaction(async (client) => {
        const partialOwner = await queryOne<SqlRow & { id: string }>(
          'SELECT id FROM "user" WHERE organization_id = $1 AND lower(email) = $2 FOR UPDATE',
          [storeId, ownerEmail],
          client,
        );
        if (partialOwner) {
          await execute('DELETE FROM "session" WHERE "userId" = $1', [partialOwner.id], client);
          await execute('DELETE FROM "account" WHERE "userId" = $1', [partialOwner.id], client);
          await execute('DELETE FROM "user" WHERE id = $1', [partialOwner.id], client);
        }
        await execute("DELETE FROM organizations WHERE id = $1", [storeId], client);
      });
    } catch {
      // A failed cleanup is reported as a provisioning error and can be repaired by the platform administrator.
    }
    return Response.json({ error: { code: "STORE_CREATE_FAILED", message: "Não foi possível criar a loja. Confirme se o e-mail já está em uso e tente novamente." } }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "O pedido contém dados inválidos." } }, { status: 400 });
  }
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", message: "A alteração do estado da loja não é válida." } }, { status: 400 });

  const outcome = await inTransaction(async (client) => {
    const store = await queryOne<SqlRow & { id: string; status: string }>(
      "SELECT id, status FROM organizations WHERE id = $1 FOR UPDATE",
      [parsed.data.storeId],
      client,
    );
    if (!store) return { error: "STORE_NOT_FOUND" as const };
    if (store.status === (parsed.data.active ? "active" : "inactive")) return { changed: false as const };

    await execute("UPDATE organizations SET status = $1 WHERE id = $2", [parsed.data.active ? "active" : "inactive", store.id], client);
    const owner = await queryOne<SqlRow & { id: string; role: string | null; banned: boolean | null }>(
      'SELECT id, role, banned FROM "user" WHERE organization_id = $1 AND is_store_owner IS TRUE FOR UPDATE',
      [store.id],
      client,
    );

    if (owner) {
      if (parsed.data.active) {
        await execute(
          `UPDATE "user"
           SET banned = CASE WHEN "banReason" = $1 THEN FALSE ELSE banned END,
               "banReason" = CASE WHEN "banReason" = $1 THEN NULL ELSE "banReason" END,
               "banExpires" = CASE WHEN "banReason" = $1 THEN NULL ELSE "banExpires" END
           WHERE id = $2`,
          [PLATFORM_DEACTIVATION_REASON, owner.id],
          client,
        );
      } else {
        if (!hasPlatformAdministratorRole(owner.role) && owner.banned !== true) {
          await execute(
            'UPDATE "user" SET banned = TRUE, "banReason" = $1, "banExpires" = NULL WHERE id = $2',
            [PLATFORM_DEACTIVATION_REASON, owner.id],
            client,
          );
        }
        await execute('DELETE FROM "session" WHERE "userId" = $1', [owner.id], client);
      }
    }
    return { changed: true as const };
  });

  if ("error" in outcome) return Response.json({ error: { code: outcome.error, message: "A loja não foi encontrada." } }, { status: 404 });
  return Response.json({ updated: outcome.changed, active: parsed.data.active }, { headers: { "Cache-Control": "no-store" } });
}
