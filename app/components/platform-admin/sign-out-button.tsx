"use client";

import { useState } from "react";
import { authClient } from "@/app/lib/auth-client";
import Icon from "../ui-icon";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    if (!navigator.onLine) {
      setError("Ligue-se à internet para terminar a sessão com segurança.");
      return;
    }

    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Não foi possível encerrar a sessão. Tente novamente.");
        return;
      }
      window.location.replace("/loja");
    } catch {
      setError("Não foi possível contactar o servidor. Verifique a ligação e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return <>
    <button className="nav-button platform-sign-out-button" type="button" aria-label={pending ? "A terminar…" : "Terminar sessão"} title="Terminar sessão" disabled={pending} onClick={() => void signOut()}>
      <span className="nav-icon"><Icon name="logout" size={21} /></span>
      <span className="nav-text">{pending ? "A terminar…" : "Terminar sessão"}</span>
    </button>
    {error && <span className="platform-sign-out-error" role="alert">{error}</span>}
  </>;
}
