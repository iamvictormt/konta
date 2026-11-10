import { getCommerceActor } from "@/app/lib/server/actor";
import { processSyncBatch, syncOperationSchema } from "@/app/lib/server/commerce-sync";
import { z } from "zod";

const batchSchema = z.object({ operations: z.array(z.unknown()).min(1).max(100) });
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: Request) {
  try {
    const actor = await getCommerceActor(request.headers);
    if (!actor) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "A sessão expirou. Entre novamente para sincronizar." } }, { status: 401 });
    }

    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "O lote de sincronização excede o limite permitido." } }, { status: 413 });
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(bodyText);
    } catch {
      return Response.json({ error: { code: "INVALID_JSON", message: "O pedido de sincronização não contém JSON válido." } }, { status: 400 });
    }

    const parsedBatch = batchSchema.safeParse(rawBody);
    if (!parsedBatch.success) {
      return Response.json({ error: { code: "INVALID_BATCH", message: "Envie entre 1 e 100 operações por lote." } }, { status: 400 });
    }

    const operations = [];
    for (const value of parsedBatch.data.operations) {
      const parsed = syncOperationSchema.safeParse(value);
      if (!parsed.success) {
        return Response.json({ error: { code: "INVALID_OPERATION", message: "Uma operação contém dados inválidos e não foi enviada." } }, { status: 400 });
      }
      operations.push(parsed.data);
    }

    const results = await processSyncBatch(operations, actor);
    return Response.json({ results, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "SYNC_FAILED", message: "A sincronização falhou. Os registos continuam guardados neste dispositivo." } }, { status: 500 });
  }
}
