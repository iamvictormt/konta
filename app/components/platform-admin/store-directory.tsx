"use client";

import { useState } from "react";
import Icon from "../ui-icon";
import { StoreCard } from "./store-card";
import type { PlatformStore } from "./types";

export function StoreDirectory({
  stores,
  loading,
  busyStoreId,
  onGrantAccess,
  onViewFinancials,
  onRevokeAccess,
  onToggleStatus,
}: {
  stores: PlatformStore[];
  loading: boolean;
  busyStoreId: string;
  onGrantAccess: (store: PlatformStore) => void;
  onViewFinancials: (store: PlatformStore) => void;
  onRevokeAccess: (store: PlatformStore) => void;
  onToggleStatus: (store: PlatformStore) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const search = query.trim().toLocaleLowerCase();
  const filteredStores = stores.filter((store) =>
    (statusFilter === "all" || store.status === statusFilter)
    && (!search || `${store.name} ${store.owner?.name ?? ""} ${store.owner?.email ?? ""}`.toLocaleLowerCase().includes(search)));
  const activeCount = stores.filter((store) => store.status === "active").length;

  return <section className="platform-store-section">
    <div className="platform-section-heading platform-store-directory-heading">
      <div><h2>Lojas registadas</h2><p>{activeCount} activas · {stores.length - activeCount} inactivas</p></div>
      <label className="platform-store-search">
        <Icon name="search" size={17} />
        <span className="sr-only">Pesquisar lojas</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar loja ou proprietário" />
      </label>
    </div>
    <div className="platform-store-filters" role="group" aria-label="Filtrar lojas por estado">
      {(["all", "active", "inactive"] as const).map((status) => <button
        key={status}
        type="button"
        className={statusFilter === status ? "is-active" : ""}
        aria-pressed={statusFilter === status}
        onClick={() => setStatusFilter(status)}
      >{status === "all" ? "Todas" : status === "active" ? "Activas" : "Inactivas"}</button>)}
    </div>
    <div className="platform-store-grid">{filteredStores.map((store) => <StoreCard
      key={store.id}
      store={store}
      busy={busyStoreId === store.id}
      onGrantAccess={onGrantAccess}
      onViewFinancials={onViewFinancials}
      onRevokeAccess={onRevokeAccess}
      onToggleStatus={onToggleStatus}
    />)}{filteredStores.length === 0 && <div className="platform-empty platform-empty-card">{stores.length === 0 ? loading ? "A carregar lojas…" : "Ainda não há lojas registadas." : "Nenhuma loja corresponde à pesquisa."}</div>}</div>
  </section>;
}
