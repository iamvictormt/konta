"use client";

import { useState } from "react";
import { authClient } from "@/app/lib/auth-client";

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

  return <div className="platform-sign-out">
    <button className="button button-ghost" type="button" disabled={pending} onClick={() => void signOut()}>
      {pending ? "A terminar sessão…" : "Terminar sessão"}
    </button>
    {error && <span className="platform-sign-out-error" role="alert">{error}</span>}
  </div>;
}
