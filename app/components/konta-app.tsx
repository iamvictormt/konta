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
import { hasStorePermission } from "@/app/lib/store-permissions";

export default function KontaApp() {
  const pathname = usePathname();
  const section = pathSections[pathname] ?? "inicio";
  const currentModule = moduleForPath(pathname);
  const isLoginPage = pathname === "/login";
  const [toast, setToast] = useState("");
  const session = useCommerceSession(setToast);
  const { profile, authReady, online, authMessage, acceptProfile, storeName, syncMessage, signOut } = session;
  const canViewRevenue = profile ? hasStorePermission(profile, "revenue:read") : false;
  const canManageResellers = profile?.isOwner === true && profile.role === "admin";
  const signedIn = Boolean(profile);

  useEffect(() => {
    if (!authReady) return;
    if (!profile && !isLoginPage) {
      window.history.replaceState(null, "", "/login");
    } else if (profile && isLoginPage) {
      const landingModule = profile.enabledModules.includes("commerce") ? "commerce" : profile.enabledModules[0];
      if (landingModule) window.history.replaceState(null, "", STORE_MODULE_ROUTES[landingModule]);
    }
  }, [authReady, isLoginPage, profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (signedIn && currentModule === "commerce" && (
      (section === "relatorios" && !canViewRevenue) || (section === "revendedores" && !canManageResellers)
    )) {
      window.history.replaceState(null, "", sectionPaths.inicio);
      const noticeTimer = window.setTimeout(() => {
        setToast(section === "revendedores" ? "A gestão de revendedores é reservada ao proprietário." : "A sua conta não tem acesso à faturação.");
      }, 0);
      return () => window.clearTimeout(noticeTimer);
    }
  }, [signedIn, canViewRevenue, canManageResellers, section, currentModule]);

  function changeModule(moduleId: StoreModuleId) {
    if (!profile?.enabledModules.includes(moduleId)) return;
    const nextPath = STORE_MODULE_ROUTES[moduleId];
    if (pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
      window.scrollTo(0, 0);
    }
  }

  function changeSection(nextSection: Section) {
    if (!canViewRevenue && nextSection === "relatorios") {
      setToast("A sua conta não tem acesso à faturação.");
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

  if (isLoginPage) return <LoadingScreen />;

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
