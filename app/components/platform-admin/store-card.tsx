"use client";

import { useState } from "react";
import Icon from "../ui-icon";
import { STORE_MODULES } from "../../lib/store-modules";
import { StoreStatusDialog } from "./store-status-dialog";
import type { PlatformStore } from "./types";

type StoreCardProps = {
  store: PlatformStore;
  busy: boolean;
  onGrantAccess: (store: PlatformStore) => void;
  onViewFinancials: (store: PlatformStore) => void;
  onRevokeAccess: (store: PlatformStore) => void;
  onToggleStatus: (store: PlatformStore) => void;
};

export function StoreCard({ store, busy, onGrantAccess, onViewFinancials, onRevokeAccess, onToggleStatus }: StoreCardProps) {
  const [confirmStatus, setConfirmStatus] = useState(false);
  const active = store.status === "active";
  const lastSyncLabel = store.lastSyncAt
    ? new Date(store.lastSyncAt).toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Ainda sem operações recebidas";

  return <article className="platform-store-card">
    <div className="platform-store-topline">
      <span className="platform-store-icon"><Icon name="store" size={21} /></span>
      <div className="platform-store-heading"><h2>{store.name}</h2><span className="platform-store-id">{store.id}</span></div>
      <span className={`platform-store-state${active ? "" : " is-inactive"}`}><span />{active ? "Activa" : "Inactiva"}</span>
    </div>
    <div className="platform-store-details">
      <div><span>Proprietário</span><strong>{store.owner?.name ?? "Ainda não atribuído"}</strong><small>Utilizador: {store.owner?.email ?? "Sem acesso configurado"}</small></div>
      <div><span>Módulos activos</span><div className="platform-module-tags">{store.enabledModules.map((moduleId) => <span key={moduleId}>{STORE_MODULES.find((item) => item.id === moduleId)?.label ?? moduleId}</span>)}</div><small>{store.countryCode ? `País: ${store.countryCode}` : "País por definir"} · {store.currency}</small></div>
      <div><span>Registada em</span><strong>{new Date(store.createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}</strong><small>{store.owner?.createdAt ? `Acesso criado em ${new Date(store.owner.createdAt).toLocaleDateString("pt-PT")}` : "Conta proprietária"}</small></div>
    </div>
    <div className="platform-store-sync"><Icon name="clock" size={15} /><span>Última operação sincronizada</span><strong>{lastSyncLabel}</strong><small>Hora da última operação registada pelo servidor; não indica ligação actual.</small></div>
    <div className="platform-store-actions">
      {store.supportAccess ? <>
        <button className="button button-primary" type="button" disabled={busy} onClick={() => onViewFinancials(store)}><Icon name="chart" size={16} />Consultar resumo financeiro</button>
        <button className="button button-ghost" type="button" disabled={busy} onClick={() => onRevokeAccess(store)}>Encerrar acesso</button>
      </> : <button className="button button-ghost" type="button" disabled={busy} onClick={() => onGrantAccess(store)}><Icon name="user" size={16} />Abrir acesso de suporte</button>}
      <button className={`button ${active ? "button-ghost platform-deactivate-button" : "button-primary"}`} type="button" disabled={busy} onClick={() => active ? setConfirmStatus(true) : onToggleStatus(store)}>
        <Icon name={active ? "close" : "check"} size={16} />{active ? "Desactivar loja" : "Reactivar loja"}
      </button>
      {store.supportAccess && <span className="platform-access-expiry">Acesso até {new Date(store.supportAccess.expiresAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} · {store.supportAccess.reason}</span>}
    </div>
    {confirmStatus && <StoreStatusDialog
      store={store}
      busy={busy}
      onClose={() => setConfirmStatus(false)}
      onConfirm={() => { onToggleStatus(store); setConfirmStatus(false); }}
    />}
  </article>;
}
