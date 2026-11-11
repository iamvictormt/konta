import { useId, useRef, useState } from "react";
import Icon from "../../ui-icon";

export function SidebarSignOut({ online, onSignOut }: { online: boolean; onSignOut: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);

  async function confirmSignOut() {
    if (!online || busy) return;
    setBusy(true);
    try {
      await onSignOut();
    } finally {
      dialogRef.current?.close();
      setBusy(false);
    }
  }

  return <>
    <button className="nav-button" type="button" aria-label="Sair da conta" title="Sair da conta" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
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
          <p id={descriptionId}>{online ? "Terá de voltar a entrar para aceder à sua loja." : "Ligue-se à internet para terminar a sessão."}</p>
        </div>
      </div>
      <div className="modal-actions">
        <button className="button button-ghost" type="button" autoFocus disabled={busy} onClick={() => dialogRef.current?.close()}>Cancelar</button>
        <button className="button button-primary" type="button" disabled={!online || busy} onClick={() => void confirmSignOut()}>{busy ? "A sair…" : "Sair da conta"}</button>
      </div>
    </dialog>
  </>;
}
