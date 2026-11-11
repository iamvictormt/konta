"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthScreen } from "./konta/auth/auth-screen";
import { LoadingScreen } from "./konta/auth/loading-screen";
import { ModuleAccessScreen } from "./konta/auth/module-access-screen";
import { pathSections, sectionPaths } from "./konta/navigation";
import { ToastNotice } from "./konta/shared/toast-notice";
import { useCommerceSession } from "./konta/hooks/use-commerce-session";
import { moduleForPath, STORE_MODULE_ROUTES, type StoreModuleId } from "../lib/store-modules";
import { CommerceWorkspace } from "./konta/commerce-workspace";
import type { Section } from "./konta/types";

export default function KontaApp() {
  const pathname = usePathname();
  const section = pathSections[pathname] ?? "inicio";
  const currentModule = moduleForPath(pathname);
  const [toast, setToast] = useState("");
  const session = useCommerceSession(setToast);
  const { profile, authReady, online, authMessage, acceptProfile, storeName, syncMessage, signOut } = session;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (currentModule === "commerce" && profile?.role === "collaborator" && section === "relatorios") {
      window.history.replaceState(null, "", sectionPaths.inicio);
      const noticeTimer = window.setTimeout(() => {
        setToast("Os relatórios financeiros estão disponíveis para o administrador.");
      }, 0);
      return () => window.clearTimeout(noticeTimer);
    }
  }, [profile?.role, section, currentModule]);

  function changeModule(moduleId: StoreModuleId) {
    if (!profile?.enabledModules.includes(moduleId)) return;
    const nextPath = STORE_MODULE_ROUTES[moduleId];
    if (pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
      window.scrollTo(0, 0);
    }
  }

  function changeSection(nextSection: Section) {
    if (profile?.role !== "admin" && nextSection === "relatorios") {
      setToast("Os relatórios financeiros estão disponíveis para o administrador.");
      return;
    }
    if (pathname !== sectionPaths[nextSection]) {
      window.history.pushState(null, "", sectionPaths[nextSection]);
      window.scrollTo(0, 0);
    }
  }

  if (!authReady) return <LoadingScreen />;
  if (!profile) {
    return <AuthScreen
      online={online}
      initialMessage={authMessage}
      onSignedIn={(nextProfile, nextStoreName) => { void acceptProfile(nextProfile, nextStoreName); }}
    />;
  }

  const commerceActive = currentModule === "commerce" && profile.enabledModules.includes("commerce");

  return <>
    <CommerceWorkspace
      key={profile.organizationId + ":" + profile.id}
      active={commerceActive}
      section={section}
      profile={profile}
      session={session}
      onNavigate={changeSection}
      onModuleNavigate={changeModule}
      notify={setToast}
    />
    {commerceActive ? <ToastNotice message={toast} /> : (
      <ModuleAccessScreen
        profile={profile}
        storeName={storeName}
        online={online}
        message={syncMessage}
        currentModule={currentModule}
        onModuleNavigate={changeModule}
        onSignOut={() => { void signOut(); }}
      />
    )}
  </>;
}
