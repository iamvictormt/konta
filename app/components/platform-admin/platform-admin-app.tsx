"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "../ui-icon";
import { FinancialSummaryPanel } from "./financial-summary-panel";
import { CreateStoreDialog } from "./create-store-dialog";
import { PlatformSignOut } from "./platform-sign-out";
import { StoreDirectory } from "./store-directory";
import { StoreDetailsPanel } from "./store-details-panel";
import { SupportAccessDialog } from "./support-access-dialog";
import { usePlatformAdmin } from "./use-platform-admin";
import { MobileHeader, useMobileDrawer } from "../konta/layout/mobile-header";
import { SidebarToggle } from "../konta/layout/sidebar-toggle";

type PlatformProfile = { id: string; name: string; email: string; hasStoreAccess: boolean };

export function PlatformAdminApp({ profile }: { profile: PlatformProfile }) {
  const admin = usePlatformAdmin();
  const refreshing = admin.loading;
  const drawer = useMobileDrawer();
  const [collapsed, setCollapsed] = useState(false);
  const [openStoreId, setOpenStoreId] = useState<string | null>(null);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const sidebarCollapsed = collapsed && !drawer.open;
  const openStore = admin.stores.find((store) => store.id === openStoreId);

  function closeDetails() {
    setOpenStoreId(null);
    detailTrigger.current?.focus();
  }

  return <div className={`app-frame platform-admin-frame ${sidebarCollapsed ? "app-frame--sidebar-collapsed" : ""}`}>
    <MobileHeader menuOpen={drawer.open} onMenuToggle={() => drawer.setOpen(!drawer.open)} />
    {drawer.open && <button className="sidebar-scrim" type="button" aria-label="Fechar menu" onClick={() => drawer.setOpen(false)} />}
    <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""} ${drawer.open ? "is-drawer-open" : ""}`} aria-label="Navegação da administração">
      <div className="sidebar-head">
        <div className="brand">
          <div className="brand-logo-frame">
            <Image src="/images/konta-logo.svg" alt="Kontá — Administração da plataforma" width={1152} height={512} sizes="180px" loading="eager" />
          </div>
          <div className="brand-mark" aria-hidden="true">
            <Image src="/images/konta-mark.svg" alt="" width={270} height={270} sizes="28px" />
          </div>
        </div>
        <button className="sidebar-close" type="button" aria-label="Fechar menu" onClick={() => drawer.setOpen(false)}><Icon name="close" size={18} /></button>
        <SidebarToggle collapsed={sidebarCollapsed} onToggle={() => setCollapsed((current) => !current)} />
      </div>
      <nav id="primary-navigation" className="nav-list" aria-label="Administração">
        <a className="nav-button is-active" href="/plataforma" aria-current="page" aria-label="Gestão de lojas" title={sidebarCollapsed ? "Gestão de lojas" : undefined}><span className="nav-icon"><Icon name="store" size={21} /></span><span className="nav-text">Gestão de lojas</span></a>
        {profile.hasStoreAccess && <Link className="nav-button" href="/loja" aria-label="A minha loja" title={sidebarCollapsed ? "A minha loja" : undefined}><span className="nav-icon"><Icon name="home" size={21} /></span><span className="nav-text">A minha loja</span></Link>}
        <PlatformSignOut />
      </nav>
      <div className="sidebar-spacer" />
      {!sidebarCollapsed && <p className="platform-sidebar-account"><strong>{profile.name}</strong><span>Administrador geral</span></p>}
    </aside>

    <div className="app-main">
      <main className="page-content platform-admin-content">
        <div className="page-heading">
          <div><h1>Gestão de lojas</h1><p>Crie as contas, atribua módulos e acompanhe o estado de cada loja.</p></div>
          <div className="heading-actions">
            <button className="button button-primary" type="button" onClick={() => admin.setCreateStoreOpen(true)}><Icon name="plus" size={16} />Criar loja</button>
            <button className="button button-ghost" type="button" disabled={refreshing} onClick={() => { void admin.refresh(); }}><Icon name="clock" size={16} />{refreshing ? "A actualizar…" : "Actualizar"}</button>
          </div>
        </div>
      {admin.notice && <p className="platform-notice" role="status">{admin.notice}</p>}

      <StoreDirectory
        stores={admin.stores}
        loading={admin.loading}
        openStoreId={openStore?.id ?? null}
        onOpenStore={(id, trigger) => {
          detailTrigger.current = trigger;
          setOpenStoreId((current) => current === id ? null : id);
        }}
      >
        {openStore && <StoreDetailsPanel
          key={openStore.id}
          store={openStore}
          busy={admin.busyStoreId === openStore.id}
          onClose={closeDetails}
          onGrantAccess={admin.setSelectedStore}
          onViewFinancials={(store) => void admin.viewFinancials(store)}
          onRevokeAccess={(store) => void admin.revokeAccess(store)}
          onToggleStatus={(store) => void admin.setStoreActive(store, store.status !== "active")}
        >
          {admin.financialSummary && admin.financialStore?.id === openStore.id && openStore.supportAccess?.id === admin.financialSummary.grantId && (
            <FinancialSummaryPanel storeName={openStore.name} summary={admin.financialSummary} />
          )}
        </StoreDetailsPanel>}
      </StoreDirectory>
      <footer className="platform-admin-footer">Kontá · A administração da plataforma não concede acesso permanente às contas das lojas.</footer>
      </main>
    </div>

    {admin.selectedStore && <SupportAccessDialog
      store={admin.selectedStore}
      busy={admin.busyStoreId === admin.selectedStore.id}
      onClose={() => admin.setSelectedStore(null)}
      onSubmit={(reason, duration) => void admin.grantAccess(reason, duration)}
    />}
    {admin.createStoreOpen && <CreateStoreDialog
      busy={admin.creatingStore}
      onClose={() => admin.setCreateStoreOpen(false)}
      onSubmit={admin.createStore}
    />}
  </div>;
}
