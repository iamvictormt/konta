import { useState, type FormEvent } from "react";
import { authClient } from "../../../lib/auth-client";
import FormField from "../../ui/form-field";

export function EmailChangeEditor({ currentEmail, online }: { currentEmail: string; online: boolean }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (nextEmail !== confirmation.trim().toLowerCase()) { setError("Os endereços de e-mail não coincidem."); return; }
    if (nextEmail === currentEmail.toLowerCase()) { setError("Introduza um endereço diferente do actual."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.changeEmail({ newEmail: nextEmail, callbackURL: "/loja/definicoes" });
      if (result.error) throw new Error("Não foi possível solicitar a alteração. Tente novamente ou contacte o administrador da Kontá.");
      setMessage("Se o endereço puder ser utilizado, receberá uma mensagem de confirmação. O e-mail actual continua válido até confirmar o novo.");
      setEditing(false); setEmail(""); setConfirmation("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível solicitar a alteração.");
    } finally { setBusy(false); }
  }

  return <div className="settings-email-editor">
    {!editing ? <button className="button button-ghost" type="button" disabled={!online} onClick={() => { setMessage(""); setError(""); setEditing(true); }}>Alterar e-mail de acesso</button> : <form className="settings-edit-form" onSubmit={(event) => void submit(event)}>
      <p>Enviaremos um link ao novo endereço para confirmar que tem acesso a ele.</p>
      <FormField id="new-access-email" label="Novo e-mail"><input id="new-access-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || !online} /></FormField>
      <FormField id="confirm-access-email" label="Confirme o novo e-mail"><input id="confirm-access-email" type="email" autoComplete="off" required maxLength={254} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy || !online} /></FormField>
      {error && <p className="settings-form-error" role="alert">{error}</p>}
      <div className="settings-edit-actions"><button className="button button-ghost" type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy || !online}>{busy ? "A enviar…" : "Enviar confirmação"}</button></div>
    </form>}
    {message && <p className="settings-form-message" role="status">{message}</p>}
  </div>;
}
