import { hasStorePermission } from "@/app/lib/store-permissions";
import { z } from "zod";
import { getCommerceActor } from "@/app/lib/server/actor";
import { cloudinaryConfig, productImageId, productImageUrl } from "@/app/lib/server/product-images";

const maxBytes = 8 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  const origin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
  if (request.headers.get("origin") !== origin) return Response.json({ error: "Pedido não autorizado." }, { status: 403 });
  const actor = await getCommerceActor(request.headers);
  if (!actor || !hasStorePermission(actor, "products:write")) return Response.json({ error: "A sua conta não tem permissão para carregar fotos." }, { status: 403 });
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("productId"));
  const type = request.headers.get("content-type") ?? "";
  if (!id.success || !imageTypes.has(type) || !request.body) {
    return Response.json({ error: "Escolha uma foto JPEG, PNG, WebP ou HEIC/HEIF." }, { status: 400 });
  }
  try {
    const config = cloudinaryConfig();
    if (!config) return Response.json({ error: "O serviço de fotos não está configurado." }, { status: 503 });
    const reader = request.body.getReader();
    const chunks: BlobPart[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return Response.json({ error: "A foto deve ter até 8 MB." }, { status: 413 });
      }
      chunks.push(new Uint8Array(value));
    }
    const publicId = productImageId(actor.organizationId, id.data);
    const body = new FormData();
    body.set("file", new Blob(chunks, { type }), "product");
    body.set("public_id", publicId);
    body.set("overwrite", "false");
    body.set("allowed_formats", "jpg,jpeg,png,webp,heic,heif");
    body.set("format", "jpg");
    body.set("transformation", "c_limit,w_1600,h_1600");
    const uploaded = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud}/image/upload`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${config.key}:${config.secret}`).toString("base64")}` },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!uploaded.ok) return Response.json({ error: "Não foi possível carregar a foto. Verifique o arquivo e tente novamente." }, { status: 502 });
    return Response.json({ imageUrl: productImageUrl(config.cloud, publicId) });
  } catch {
    return Response.json({ error: "Não foi possível carregar a foto. Tente novamente." }, { status: 502 });
  }
}
