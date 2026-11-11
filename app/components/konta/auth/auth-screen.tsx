import { useState, type FormEvent } from "react";
import Image from "next/image";
import FormField from "../../ui/form-field";
import PasswordInput from "../../ui/password-input";
import type { CommerceProfile } from "../../../lib/model";

export function AuthScreen({ online, initialMessage, onSignedIn }: { online: boolean; initialMessage: string; onSignedIn: (profile: CommerceProfile, storeName?: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setMessage("A primeira autenticação precisa de internet. Ligue-se e tente novamente.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        setMessage(response.status === 403
          ? "O acesso desta loja está desactivado. Contacte o administrador da plataforma."
          : response.status === 401 || response.status === 400
          ? "E-mail ou palavra-passe incorretos."
          : "Não foi possível iniciar sessão. Tente novamente mais tarde.");
        return;
      }
      const profileResponse = await fetch("/api/commerce/profile", {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (profileResponse.ok) {
        const result = await profileResponse.json() as { profile: CommerceProfile; organization?: { name: string } };
        onSignedIn(result.profile, result.organization?.name);
        return;
      }
      if (profileResponse.status === 403) {
        const platformResponse = await fetch("/api/platform/session", { cache: "no-store", signal: AbortSignal.timeout(5_000) });
        if (platformResponse.ok) {
          window.location.replace("/plataforma");
          return;
        }
        setMessage("Esta conta não tem acesso a uma loja. Contacte o administrador da plataforma.");
        return;
      }
      setMessage("A sessão foi criada, mas o perfil da loja não pôde ser carregado.");
    } catch {
      setMessage("Sem ligação ao servidor. Confirme a internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-screen">
    <div className="auth-card">
      <div className="auth-brand">
        <div className="brand-logo-frame auth-logo-frame">
          <Image src="/images/konta-logo.svg" alt="Kontá — Gestão simples. Negócios fortes." width={1152} height={512} sizes="260px" loading="eager" />
        </div>
      </div>
      <h1>Bem-vindo à Kontá</h1>
      <p className="auth-intro">Entre com as credenciais fornecidas pelo administrador.</p>
      {message && <div className="auth-message" role="alert">{message}</div>}
      {!online && <div className="auth-message">Este dispositivo ainda não tem uma sessão offline válida. A primeira autenticação exige internet.</div>}
      <form onSubmit={submit}>
        <FormField id="auth-email" label="E-mail"><input id="auth-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField id="auth-password" label="Palavra-passe"><PasswordInput id="auth-password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting || !online}>{submitting ? "A entrar…" : "Entrar"}</button>
      </form>
      <p className="auth-footnote">Os dados deste dispositivo só ficam acessíveis depois de uma autenticação online válida.</p>
    </div>
  </main>;
}
