"use client";

import { useState, type ReactNode } from "react";
import Icon from "../ui-icon";
import { STORE_MODULES } from "@/app/lib/store-modules";
import type { PlatformStore } from "./types";

export function StoreDirectory({
  stores,
  loading,
  openStoreId,
  onOpenStore,
  children,
}: {
  stores: PlatformStore[];
  loading: boolean;
  openStoreId: string | null;
  onOpenStore: (id: string, trigger: HTMLButtonElement) => void;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const search = query.trim().toLocaleLowerCase();
  const filteredStores = stores.filter((store) =>
    (statusFilter === "all" || store.status === statusFilter)
    && (!search || `${store.name} ${store.owner?.name ?? ""} ${store.owner?.email ?? ""}`.toLocaleLowerCase().includes(search)));
  const activeCount = stores.filter((store) => store.status === "active").length;
  const inactiveCount = stores.length - activeCount;

  function detailsButton(store: PlatformStore) {
    const expanded = openStoreId === store.id;
    return <button
      className="button button-ghost platform-row-action"
      type="button"
      aria-label={`Detalhes de ${store.name}`}
      aria-expanded={expanded}
      aria-controls={expanded ? "platform-store-detail" : undefined}
      onClick={(event) => onOpenStore(store.id, event.currentTarget)}
    >Detalhes<Icon name="arrow-right" size={15} /></button>;
  }

  return <section className="platform-store-section">
    <div className="platform-section-heading platform-store-directory-heading">
      <div><h2>Lojas registadas</h2><p>{activeCount} {activeCount === 1 ? "activa" : "activas"} · {inactiveCount} {inactiveCount === 1 ? "inactiva" : "inactivas"}</p></div>
    </div>
    <div className="platform-directory-toolbar">
      <label className="platform-store-search">
        <Icon name="search" size={17} />
        <span className="sr-only">Pesquisar lojas</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar loja ou proprietário" />
      </label>
      <div className="platform-store-filters" role="group" aria-label="Filtrar lojas por estado">
      {(["all", "active", "inactive"] as const).map((status) => <button
        key={status}
        type="button"
        className={statusFilter === status ? "is-active" : ""}
        aria-pressed={statusFilter === status}
        onClick={() => setStatusFilter(status)}
      >{status === "all" ? "Todas" : status === "active" ? "Activas" : "Inactivas"}</button>)}
      </div>
    </div>
    {children}
    {filteredStores.length === 0 ? (
      <p className="platform-empty platform-empty-card" role="status">{loading ? "A carregar lojas…" : stores.length === 0 ? "Ainda não há lojas registadas. Use Criar loja para adicionar a primeira." : "Nenhuma loja corresponde à pesquisa."}</p>
    ) : <>
      <div className="platform-directory-table">
        <table aria-label="Lojas registadas">
          <thead><tr><th scope="col">Loja e responsável</th><th scope="col">Estado</th><th scope="col">Módulos</th><th scope="col">Última sincronização</th><th scope="col">Ações</th></tr></thead>
          <tbody>
            {filteredStores.map((store) => <tr key={store.id}>
              <th scope="row"><StoreIdentity store={store} /></th>
              <td><StoreState active={store.status === "active"} /></td>
              <td><StoreModules store={store} /></td>
              <td><StoreLastSync date={store.lastSyncAt} /></td>
              <td>{detailsButton(store)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <ul className="platform-directory-cards">
        {filteredStores.map((store) => <li key={store.id} className="platform-directory-card">
          <div className="platform-directory-card-top"><StoreIdentity store={store} /><StoreState active={store.status === "active"} /></div>
          <StoreModules store={store} />
          <div className="platform-directory-card-bottom">
            <span><small>Última sincronização</small><StoreLastSync date={store.lastSyncAt} /></span>
            {detailsButton(store)}
          </div>
        </li>)}
      </ul>
    </>}
  </section>;
}

function StoreIdentity({ store }: { store: PlatformStore }) {
  return <span className="platform-row-identity"><strong>{store.name}</strong><span>{store.owner?.name ?? "Sem responsável"}</span></span>;
}

function StoreState({ active }: { active: boolean }) {
  return <span className={`platform-store-state${active ? "" : " is-inactive"}`}><span />{active ? "Activa" : "Inactiva"}</span>;
}

function StoreModules({ store }: { store: PlatformStore }) {
  return <div className="platform-module-tags">{store.enabledModules.map((id) => <span key={id}>{STORE_MODULES.find((module) => module.id === id)?.label ?? id}</span>)}</div>;
}

function StoreLastSync({ date }: { date: string | null }) {
  return date ? <time dateTime={date}>{new Date(date).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}</time> : <>Sem registos</>;
}
