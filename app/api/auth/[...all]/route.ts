import { toNextJsHandler } from "better-auth/next-js";
import { auth, isAuthConfigured } from "@/app/lib/server/auth";

const handlers = toNextJsHandler(auth);

function missingProductionSecret() {
  return Response.json({ error: { code: "AUTH_CONFIGURATION", message: "A autenticação ainda não foi configurada neste servidor." } }, { status: 503 });
}

export async function GET(request: Request) {
  return isAuthConfigured() ? handlers.GET(request) : missingProductionSecret();
}

export async function POST(request: Request) {
  return isAuthConfigured() ? handlers.POST(request) : missingProductionSecret();
}
