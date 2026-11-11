import { getPlatformActor, writePlatformAudit } from "@/app/lib/server/platform";
import { inTransaction, type SqlRow } from "@/app/lib/server/db";

type RouteContext = { params: Promise<{ grantId: string }> };
type RevokedGrant = SqlRow & { id: string; organization_id: string; reason: string };

export async function DELETE(request: Request, { params }: RouteContext) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { grantId } = await params;
  if (!grantId || grantId.length > 160) return Response.json({ error: { code: "INVALID_INPUT", message: "A autorização indicada é inválida." } }, { status: 400 });

  const grant = await inTransaction(async (client) => {
    const result = await client.query<RevokedGrant>(
      `UPDATE platform_support_access_grants
       SET revoked_at = $1, revoked_by_user_id = $2
       WHERE id = $3 AND granted_by_user_id = $2 AND revoked_at IS NULL
       RETURNING id, organization_id, reason`,
      [new Date().toISOString(), actor.id, grantId],
    );
    const revoked = result.rows[0];
    if (revoked) await writePlatformAudit(client, actor, "support_access.revoked", revoked.organization_id, revoked.id, revoked.reason);
    return revoked ?? null;
  });

  if (!grant) return Response.json({ error: { code: "NOT_FOUND", message: "A autorização activa não foi encontrada." } }, { status: 404 });
  return Response.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
}
