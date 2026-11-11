import type { CommerceData, CommerceProfile, OutboxOperation } from "../../../lib/model";
import { STORE_MODULES } from "../../../lib/store-modules";
import Icon from "../../ui-icon";
import { PageHeading } from "../shared/page-heading";
import { StockConflictRow } from "./stock-conflict-row";
import { StoreDetailsEditor } from "./store-details-editor";
import { EmailChangeEditor } from "./email-change-editor";

type SettingsViewProps = {
  profile: CommerceProfile;
  storeName: string;
  online: boolean;
  pendingCount: number;
  failedOperations: OutboxOperation[];
  productCount: number;
  lastSyncAt: string;
  syncMessage: string;
  stockConflicts: CommerceData["stockConflicts"];
  onRetry: () => void;
  onRefresh: () => void | Promise<void>;
  onSignOut: () => void;
  onSaveDetails: (storeName: string, ownerName: string) => Promise<void>;
};

export function SettingsView({
  profile,
  storeName,
  online,
  pendingCount,
  failedOperations,
  productCount,
  lastSyncAt,
  syncMessage,
  stockConflicts,
  onRetry,
  onRefresh,
  onSignOut,
  onSaveDetails,
}: SettingsViewProps) {
  return <>
    <PageHeading title={storeName} subtitle="Dados da loja, acesso e estado de sincronização." />
    <div className="settings-grid">
      <section className="panel settings-panel">
        <h2>Loja</h2>
        <p>Os dados fiscais e o país serão definidos antes de ativar documentos oficiais.</p>
        <div className="setting-line"><span>Nome</span><strong>{storeName}</strong></div>
        <div className="setting-line"><span>Moeda de apresentação</span><strong>Db</strong></div>
        <div className="setting-line"><span>País</span><strong>Por definir</strong></div>
        <div className="setting-line"><span>Módulos activos</span><strong>{profile.enabledModules.map((moduleId) => STORE_MODULES.find((module) => module.id === moduleId)?.label ?? moduleId).join(" · ")}</strong></div>
        <div className="setting-line"><span>Proprietário</span><strong>{profile.name}</strong></div>
        <div className="setting-line"><span>Utilizador de acesso</span><strong>{profile.email}</strong></div>
        <p>A loja tem uma única conta proprietária. O administrador da Kontá gere os módulos e o estado do acesso.</p>
        {profile.isOwner && <div className="settings-account-actions">
          <StoreDetailsEditor storeName={storeName} ownerName={profile.name} online={online} onSave={onSaveDetails} />
          <EmailChangeEditor currentEmail={profile.email} online={online} />
          {!online && <p>Ligue-se à internet para alterar os dados ou o e-mail de acesso.</p>}
        </div>}
        {profile.isPlatformAdmin && <a className="button button-ghost settings-platform" href="/plataforma">Administração da Kontá<Icon name="arrow-right" size={15} /></a>}
        <button className="button button-ghost settings-signout" type="button" onClick={onSignOut} disabled={!online}>Terminar sessão</button>
      </section>
      <section className="panel settings-panel">
        <h2>Ligação e dados</h2>
        <p>Os registos offline ficam guardados neste dispositivo e são enviados com a aplicação aberta quando a internet regressar.</p>
        <div className="setting-line"><span>Estado de rede</span><strong>{online ? "Online" : "Offline"}</strong></div>
        <div className="setting-line"><span>Produtos neste dispositivo</span><strong>{productCount}</strong></div>
        <div className="setting-line"><span>Operações na fila local</span><strong>{pendingCount}</strong></div>
        <div className="setting-line"><span>Última sincronização</span><strong>{lastSyncAt ? new Date(lastSyncAt).toLocaleString("pt-PT") : "Ainda não sincronizado"}</strong></div>
        <div className="setting-line"><span>Estado</span><strong>{syncMessage || (online ? "Pronto" : "A aguardar ligação")}</strong></div>
        {pendingCount > 0 && <button className="button button-primary settings-retry" type="button" onClick={onRetry} disabled={!online}>Tentar sincronizar novamente</button>}
        {failedOperations.length > 0 && <div className="failed-operations">
          <strong>Operações com falha</strong>
          {failedOperations.map((operation) => <div key={operation.id}>
            <span>{operation.type === "sale.create" ? "Venda" : operation.type === "expense.create" ? "Despesa" : operation.type === "cash-session.open" ? "Abertura de caixa" : operation.type === "cash-session.close" ? "Fecho de caixa" : "Produto"} · {operation.payload.id.slice(0, 8)}</span>
            <small>{operation.lastError ?? "Verifique os dados e tente novamente."}</small>
          </div>)}
        </div>}
      </section>
    </div>
    {stockConflicts.length > 0 && <section className="panel stock-conflicts-panel">
      <div className="panel-header"><div><h2 className="panel-title">Divergências de stock</h2><p className="panel-subtitle">As vendas offline foram guardadas, embora o stock disponível tenha sido excedido. O administrador reconcilia o saldo após a contagem física.</p></div></div>
      <div className="stock-conflicts-list">{stockConflicts.map((conflict) => <StockConflictRow key={conflict.id} conflict={conflict} canResolve={profile.role === "admin"} online={online} onResolved={onRefresh} />)}</div>
    </section>}
  </>;
}
