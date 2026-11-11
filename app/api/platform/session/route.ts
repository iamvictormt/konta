import { getPlatformActor } from "@/app/lib/server/platform";

export async function GET(request: Request) {
  const actor = await getPlatformActor(request.headers);
  if (!actor) return Response.json({ error: { code: "FORBIDDEN", message: "Acesso reservado à administração da Kontá." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return Response.json({ profile: actor }, { headers: { "Cache-Control": "no-store" } });
}
