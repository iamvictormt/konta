import { useState, type FormEvent } from "react";
import FormField from "../../ui/form-field";

export function EmailChangeEditor({ currentEmail, online, onSave }: { currentEmail: string; online: boolean; onSave: (email: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (nextEmail === currentEmail.toLowerCase()) { setError("Introduza um endereço diferente do actual."); return; }
    setBusy(true); setError("");
    try {
      await onSave(nextEmail);
      setEditing(false); setEmail("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível guardar a alteração.");
    } finally { setBusy(false); }
  }

  return <div className="settings-email-editor">
    {!editing ? <button className="button button-ghost" type="button" disabled={!online} onClick={() => { setError(""); setEditing(true); }}>Alterar e-mail de acesso</button> : <form className="settings-edit-form" onSubmit={(event) => void submit(event)}>
      <p>O novo endereço será usado no próximo início de sessão.</p>
      <FormField id="new-access-email" label="Novo e-mail"><input id="new-access-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || !online} /></FormField>
      {error && <p className="settings-form-error" role="alert">{error}</p>}
      <div className="settings-edit-actions"><button className="button button-ghost" type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy || !online}>{busy ? "A guardar…" : "Guardar e-mail"}</button></div>
    </form>}
  </div>;
}
