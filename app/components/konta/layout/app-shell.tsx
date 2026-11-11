import { useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import Image from "next/image";
import type { CommerceProfile } from "../../../lib/model";
import Icon from "../../ui-icon";
import { navItems, sectionPaths } from "../navigation";
import type { Section } from "../types";
import type { StoreModuleId } from "../../../lib/store-modules";
import { ModuleSwitcher } from "./module-switcher";
import { MobileHeader, useMobileDrawer } from "./mobile-header";
import { SidebarSignOut } from "./sidebar-sign-out";
import { SidebarToggle } from "./sidebar-toggle";

const TABLET_QUERY = "(min-width: 651px) and (max-width: 900px)";

function subscribeToTabletQuery(onChange: () => void) {
  const mediaQuery = window.matchMedia(TABLET_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getTabletQuerySnapshot() {
  return window.matchMedia(TABLET_QUERY).matches;
}

function getTabletQueryServerSnapshot() {
  return false;
}

type AppShellProps = {
  section: Section;
  profile: CommerceProfile;
  storeName: string;
  online: boolean;
  pendingCount: number;
  lastSyncAt: string;
  syncMessage: string;
  storageError: string;
  stockConflictCount: number;
  onNavigate: (section: Section) => void;
  onModuleNavigate: (moduleId: StoreModuleId) => void;
  onSignOut: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({
  section,
  profile,
  storeName,
  online,
  pendingCount,
  lastSyncAt,
  syncMessage,
  storageError,
  stockConflictCount,
  onNavigate,
  onModuleNavigate,
  onSignOut,
  children,
}: AppShellProps) {
  // Avisos de sincronização fechados nesta abertura do sistema; voltam a aparecer ao reabrir.
  const [dismissedSyncNotices, setDismissedSyncNotices] = useState<string[]>([]);
  const drawer = useMobileDrawer();
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const isTablet = useSyncExternalStore(subscribeToTabletQuery, getTabletQuerySnapshot, getTabletQueryServerSnapshot);
  const sidebarCollapsed = sidebarOverride ?? isTablet;
  const visibleNav = navItems.filter((item) => profile.role === "admin" || item.id !== "relatorios");
  const syncNeedsAttention = /falh|divergência|expirad|indisponível/i.test(syncMessage);
  // Sucesso: um único aviso para a sessão. Problemas: um por mensagem, para não esconder um erro novo.
  const syncNoticeKey = syncNeedsAttention ? syncMessage : "ok";
  const connectionLabel = online ? "Online" : "Offline";
  const connectionDetail = pendingCount > 0 ? `${connectionLabel} · ${pendingCount} pendente${pendingCount === 1 ? "" : "s"}` : connectionLabel;

  function navigate(nextSection: Section) {
    drawer.setOpen(false);
    onNavigate(nextSection);
  }

  function followSectionLink(event: ReactMouseEvent<HTMLAnchorElement>, nextSection: Section) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(nextSection);
  }

  return (
    <div className={`app-frame ${sidebarCollapsed ? "app-frame--sidebar-collapsed" : ""}`}>
      <MobileHeader menuOpen={drawer.open} onMenuToggle={() => drawer.setOpen(!drawer.open)}>
        <ModuleSwitcher enabledModules={profile.enabledModules} currentModule="commerce" onNavigate={(moduleId) => { drawer.setOpen(false); onModuleNavigate(moduleId); }} />
      </MobileHeader>
      {drawer.open && <button className="sidebar-scrim" type="button" aria-label="Fechar menu" onClick={() => drawer.setOpen(false)} />}
      <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""} ${drawer.open ? "is-drawer-open" : ""}`} aria-label="Navegação principal">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-logo-frame">
              <Image src="/images/konta-logo.svg" alt="Kontá — Gestão simples. Negócios fortes." width={1152} height={512} sizes="180px" loading="eager" />
            </div>
            <div className="brand-mark" aria-hidden="true">
              <Image src="/images/konta-mark.svg" alt="" width={270} height={270} sizes="28px" />
            </div>
          </div>
          <button className="sidebar-close" type="button" aria-label="Fechar menu" onClick={() => drawer.setOpen(false)}><Icon name="close" size={18} /></button>
          <SidebarToggle collapsed={sidebarCollapsed} onToggle={() => setSidebarOverride(!sidebarCollapsed)} />
        </div>
        <nav id="primary-navigation" className="nav-list">
          {visibleNav.map((item) => {
            // Este item mostra o nome da loja; o estado da ligação pulsa ao lado.
            const isStore = item.id === "loja";
            const label = isStore ? storeName : item.label;
            return (
              <a key={item.id} href={sectionPaths[item.id]} className={`nav-button ${section === item.id ? "is-active" : ""}`} onClick={(event) => followSectionLink(event, item.id)} title={isStore ? `${label} · ${connectionDetail}` : sidebarCollapsed ? label : undefined} aria-current={section === item.id ? "page" : undefined}>
                <span className="nav-icon"><Icon name={item.icon} size={21} /></span>
                <span className="nav-text">{label}</span>
                {isStore && <span className={`nav-status ${online ? "is-online" : "is-offline"}`} role="img" aria-label={connectionDetail} />}
              </a>
            );
          })}
          <SidebarSignOut online={online} onSignOut={onSignOut} />
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-promo"><p>Juntos<br />fazemos crescer!</p><svg className="sidebar-promo-swoosh" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 10C60 2 140 1 198 4 140 5 60 6 2 10Z" /></svg></div>
      </aside>

      <div className={`app-main ${section === "inicio" ? "app-main--home" : ""}`}>
        <div className="scenic-backdrop" aria-hidden="true">
          <Image src="/images/store-header.png" alt="" fill sizes="(max-width: 650px) 100vw, calc(100vw - 218px)" preload />
        </div>
        <main className="page-content">
          <div className="module-switcher-bar"><ModuleSwitcher enabledModules={profile.enabledModules} currentModule="commerce" onNavigate={onModuleNavigate} /></div>
          {!online && <div className="offline-notice"><Icon name="wifi-off" size={17} /><span><strong>Modo offline.</strong> Os registos novos ficam guardados neste dispositivo até a sincronização com o servidor estar disponível.</span></div>}
          {syncMessage && online && !dismissedSyncNotices.includes(syncNoticeKey) && <div className={`offline-notice ${syncNeedsAttention ? "error-notice" : ""}`}><Icon name={syncNeedsAttention ? "alert" : "check"} size={17} /><span>{syncMessage}{lastSyncAt && <small className="sync-time">Última sincronização: {new Date(lastSyncAt).toLocaleString("pt-PT")}</small>}</span><button className="notice-close" type="button" aria-label="Fechar aviso" onClick={() => setDismissedSyncNotices((current) => [...current, syncNoticeKey])}><Icon name="close" size={16} /></button></div>}
          {storageError && <div className="offline-notice error-notice"><Icon name="alert" size={17} /><span>{storageError}</span></div>}
          {stockConflictCount > 0 && <div className="offline-notice error-notice"><Icon name="alert" size={17} /><span>{stockConflictCount} divergência(s) de stock entre dispositivos. As vendas foram preservadas; o administrador deve reconciliar o saldo.</span></div>}
          {children}
        </main>
      </div>
    </div>
  );
}
