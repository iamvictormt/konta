"use client";

import Image from "next/image";
import Link from "next/link";
import Icon from "../ui-icon";
import { FinancialSummaryPanel } from "./financial-summary-panel";
import { CreateStoreDialog } from "./create-store-dialog";
import { SignOutButton } from "./sign-out-button";
import { StoreDirectory } from "./store-directory";
import { SupportAccessDialog } from "./support-access-dialog";
import { usePlatformAdmin } from "./use-platform-admin";

type PlatformProfile = { id: string; name: string; email: string; hasStoreAccess: boolean };

export function PlatformAdminApp({ profile }: { profile: PlatformProfile }) {
  const admin = usePlatformAdmin();
  const refreshing = admin.loading;

  return <main className="platform-admin-page">
    <header className="platform-admin-header">
      {profile.hasStoreAccess
        ? <Link className="platform-admin-brand" href="/loja" aria-label="Kontá, voltar à loja"><Image src="/images/konta-mark.svg" alt="" width={42} height={42} priority /><span><strong>KONTÁ</strong><small>Administração da plataforma</small></span></Link>
        : <div className="platform-admin-brand"><Image src="/images/konta-mark.svg" alt="" width={42} height={42} priority /><span><strong>KONTÁ</strong><small>Administração da plataforma</small></span></div>}
      <div className="platform-admin-account"><span><strong>{profile.name}</strong><small>Administrador geral · {profile.email}</small></span><SignOutButton /></div>
    </header>

    <section className="platform-admin-content">
      <div className="platform-admin-intro">
        <div><h1>Gestão de lojas</h1><p>Crie as contas, atribua módulos e acompanhe o estado de cada loja.</p></div>
        <div className="platform-admin-intro-actions">
          <button className="button button-primary" type="button" onClick={() => admin.setCreateStoreOpen(true)}><Icon name="plus" size={16} />Criar loja</button>
          <button className="button button-ghost" type="button" disabled={refreshing} onClick={() => { void admin.refresh(); }}><Icon name="clock" size={16} />{refreshing ? "A actualizar…" : "Actualizar"}</button>
        </div>
      </div>
      <div className="platform-privacy-note"><Icon name="check" size={16} /><span>A Kontá não processa pagamentos das lojas. A administração vê dados de conta; qualquer consulta financeira continua sujeita a autorização temporária e auditoria.</span></div>
      {admin.notice && <p className="platform-notice" role="status">{admin.notice}</p>}

      <StoreDirectory
        stores={admin.stores}
        loading={admin.loading}
        busyStoreId={admin.busyStoreId}
        onGrantAccess={admin.setSelectedStore}
        onViewFinancials={(store) => void admin.viewFinancials(store)}
        onRevokeAccess={(store) => void admin.revokeAccess(store)}
        onToggleStatus={(store) => void admin.setStoreActive(store, store.status !== "active")}
      />
      {admin.financialStore && admin.financialSummary && <FinancialSummaryPanel storeName={admin.financialStore.name} summary={admin.financialSummary} />}
      <footer className="platform-admin-footer">Kontá · A administração da plataforma não concede acesso permanente às contas das lojas.</footer>
    </section>

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
  </main>;
}
