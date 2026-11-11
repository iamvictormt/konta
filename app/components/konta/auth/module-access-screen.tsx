"use client";

import Image from "next/image";
import Icon from "../../ui-icon";
import { STORE_MODULES, type StoreModuleId } from "../../../lib/store-modules";
import type { CommerceProfile } from "../../../lib/model";
import { ModuleSwitcher } from "../layout/module-switcher";

export function ModuleAccessScreen({
  profile,
  storeName,
  online,
  message,
  currentModule,
  onModuleNavigate,
  onSignOut,
}: {
  profile: CommerceProfile;
  storeName: string;
  online: boolean;
  message: string;
  currentModule: StoreModuleId;
  onModuleNavigate: (moduleId: StoreModuleId) => void;
  onSignOut: () => void;
}) {
  const permitted = profile.enabledModules.includes(currentModule);
  const current = STORE_MODULES.find((item) => item.id === currentModule);
  return <main className="module-access-page">
    <header className="module-access-header">
      <Image src="/images/konta-mark.svg" alt="Kontá" width={42} height={42} priority />
      <div><strong>KONTÁ</strong><span>{storeName}</span></div>
      <span className={`module-access-connection${online ? "" : " is-offline"}`}><span />{online ? "Online" : "Offline"}</span>
    </header>
    <section className="module-access-content" aria-labelledby="module-access-title">
      <div className="module-access-switcher"><ModuleSwitcher enabledModules={profile.enabledModules} currentModule={currentModule} onNavigate={onModuleNavigate} /></div>
      <span className="module-access-icon"><Icon name="settings" size={22} /></span>
      <h1 id="module-access-title">{permitted ? current?.label : "Módulo sem acesso"}</h1>
      <p>{permitted ? "Este módulo está em desenvolvimento e ficará disponível numa próxima fase." : "A sua conta não tem acesso a este módulo. Escolha um dos módulos disponíveis acima ou contacte o administrador da Kontá."}</p>
      <ul className="module-access-list">
        {profile.enabledModules.map((moduleId) => {
          const storeModule = STORE_MODULES.find((item) => item.id === moduleId);
          if (!storeModule) return null;
          const available = moduleId === "commerce";
          return <li key={moduleId}>
            <span className="module-access-status"><Icon name={available ? "check" : "clock"} size={16} /></span>
            <span><strong>{storeModule.label}</strong><small>{available ? "Disponível nesta versão" : "Acesso configurado · módulo em desenvolvimento"}</small></span>
          </li>;
        })}
      </ul>
      <p className="module-access-note">A primeira versão da Kontá inclui Lojas e Comércio. Os módulos de Serviços e Formação serão disponibilizados por etapas.</p>
      {message && <p className="module-access-message" role="status">{message}</p>}
      <button className="button button-ghost" type="button" onClick={onSignOut} disabled={!online}>Terminar sessão</button>
    </section>
  </main>;
}
