import { useState, type FormEvent } from "react";
import FormField from "../../ui/form-field";

export function StoreDetailsEditor({ storeName, ownerName, online, onSave }: {
  storeName: string;
  ownerName: string;
  online: boolean;
  onSave: (storeName: string, ownerName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [store, setStore] = useState(storeName);
  const [owner, setOwner] = useState(ownerName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (store.trim().length < 2 || owner.trim().length < 2) {
      setError("Introduza pelo menos dois caracteres em cada nome.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(store.trim(), owner.trim());
      setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível guardar os dados.");
    } finally { setBusy(false); }
  }

  if (!editing) return <button className="button button-soft" type="button" disabled={!online} onClick={() => { setStore(storeName); setOwner(ownerName); setError(""); setEditing(true); }}>Editar dados</button>;
  return <form className="settings-edit-form" onSubmit={(event) => void submit(event)}>
    <FormField id="edit-store-name" label="Nome da loja"><input id="edit-store-name" autoComplete="organization" required minLength={2} maxLength={160} value={store} onChange={(event) => setStore(event.target.value)} disabled={busy || !online} /></FormField>
    <FormField id="edit-owner-name" label="Nome do proprietário"><input id="edit-owner-name" autoComplete="name" required minLength={2} maxLength={100} value={owner} onChange={(event) => setOwner(event.target.value)} disabled={busy || !online} /></FormField>
    {error && <p className="settings-form-error" role="alert">{error}</p>}
    <div className="settings-edit-actions"><button className="button button-ghost" type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy || !online}>{busy ? "A guardar…" : "Guardar dados"}</button></div>
  </form>;
}
