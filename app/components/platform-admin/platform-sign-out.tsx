import { useSyncExternalStore } from "react";
import { authClient } from "@/app/lib/auth-client";
import { SidebarSignOut } from "../konta/layout/sidebar-sign-out";

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOnline() {
  return navigator.onLine;
}

function getServerOnline() {
  return true;
}

async function signOut() {
  const result = await authClient.signOut();
  if (result.error) throw new Error("Não foi possível sair da conta.");
  window.location.replace("/loja");
}

export function PlatformSignOut() {
  const online = useSyncExternalStore(subscribeToConnection, getOnline, getServerOnline);
  return <SidebarSignOut
    online={online}
    onSignOut={signOut}
    description="Terá de voltar a entrar para aceder ao painel administrativo."
  />;
}
