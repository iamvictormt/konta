import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlatformAdminApp } from "../components/platform-admin/platform-admin-app";
import { getPlatformActor } from "../lib/server/platform";

export const instant = false;

export default async function PlatformPage() {
  const actor = await getPlatformActor(await headers());
  if (!actor) redirect("/login");
  return <PlatformAdminApp profile={actor} />;
}
