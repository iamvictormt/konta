import { useId, useRef, useState } from "react";
import Icon from "../../ui-icon";

export function SidebarSignOut({
  online,
  onSignOut,
  description = "Terá de voltar a entrar para aceder à sua loja.",
}: {
  online: boolean;
  onSignOut: () => Promise<void>;
  description?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirmSignOut() {
    if (!online || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSignOut();
      dialogRef.current?.close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="nav-button" type="button" aria-label="Sair da conta" title="Sair da conta" aria-haspopup="dialog" onClick={() => {
      setFailed(false);
      dialogRef.current?.showModal();
    }}>
      <span className="nav-icon"><Icon name="logout" size={21} /></span>
      <span className="nav-text">Sair da conta</span>
    </button>
    <dialog
      ref={dialogRef}
      className="modal sign-out-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId}>Sair da conta?</h2>
          <p id={descriptionId}>{online ? description : "Ligue-se à internet para sair da conta."}</p>
        </div>
      </div>
      {failed && <p className="sign-out-error" role="alert">Não foi possível sair da conta. Tente novamente.</p>}
      <div className="modal-actions">
        <button className="button button-ghost" type="button" autoFocus disabled={busy} onClick={() => dialogRef.current?.close()}>Cancelar</button>
        <button className="button button-primary" type="button" disabled={!online || busy} onClick={() => void confirmSignOut()}>{busy ? "A sair…" : "Sair da conta"}</button>
      </div>
    </dialog>
  </>;
}
