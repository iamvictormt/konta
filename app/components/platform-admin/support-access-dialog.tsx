import { useState, type FormEvent } from "react";
import FormField from "../ui/form-field";
import { Modal } from "../konta/shared/modal";
import type { PlatformStore } from "./types";

const durations = [15, 30, 60] as const;

export function SupportAccessDialog({
  store,
  busy,
  onClose,
  onSubmit,
}: {
  store: PlatformStore;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, durationMinutes: typeof durations[number]) => void;
}) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<typeof durations[number]>(30);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(reason.trim(), duration);
  }

  return <Modal title="Abrir acesso de suporte" subtitle={`A autorização será limitada a ${store.name} e ficará registada no histórico.`} onClose={onClose}>
    <form className="support-access-form" onSubmit={submit}>
      <FormField id="support-reason" label="Motivo do atendimento"><textarea id="support-reason" minLength={12} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: ajudar a reconciliar o fecho de caixa de ontem" /></FormField>
      <fieldset className="support-duration-fieldset">
        <legend>Duração do acesso</legend>
        <div className="support-duration-options">{durations.map((item) => <button key={item} className={`support-duration-option ${duration === item ? "is-selected" : ""}`} type="button" aria-pressed={duration === item} onClick={() => setDuration(item)}>{item} min</button>)}</div>
      </fieldset>
      <p className="support-access-note">O resumo financeiro não aparece na lista de lojas. Cada consulta durante este acesso será guardada no registo de auditoria.</p>
      <div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy || reason.trim().length < 12}>{busy ? "A abrir…" : "Abrir acesso temporário"}</button></div>
    </form>
  </Modal>;
}
