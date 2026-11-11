"use client";

import { Modal } from "../konta/shared/modal";
import type { PlatformStore } from "./types";

export function StoreStatusDialog({
  store,
  busy,
  onClose,
  onConfirm,
}: {
  store: PlatformStore;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const activating = store.status === "inactive";

  return <Modal
    title={activating ? "Reactivar loja" : "Desactivar loja"}
    subtitle={activating
      ? "O proprietário voltará a poder entrar e utilizar os módulos seleccionados."
      : "O acesso online do proprietário será revogado. Um dispositivo já autenticado ainda poderá trabalhar offline até à validade local de sete dias; as operações pendentes só sincronizam depois de reactivar a loja."}
    onClose={busy ? () => undefined : onClose}
  >
    <div className="platform-status-confirmation">
      <strong>{store.name}</strong>
      <span>{store.owner?.email ?? "Sem utilizador proprietário"}</span>
    </div>
    <div className="platform-modal-actions">
      <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
      <button className={`button ${activating ? "button-primary" : "button-danger"}`} type="button" onClick={onConfirm} disabled={busy}>
        {busy ? "A guardar…" : activating ? "Reactivar acesso" : "Desactivar acesso"}
      </button>
    </div>
  </Modal>;
}
