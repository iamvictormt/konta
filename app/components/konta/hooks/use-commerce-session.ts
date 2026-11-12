import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "../../../lib/auth-client";
import {
  adoptLegacyOperations,
  clearOfflineProfile,
  getDeviceId,
  getPendingOperationCount,
  getSyncOperations,
  isOfflineOrganizationActive,
  loadCommerceData,
  loadOfflineProfile,
  loadStoreName,
  markOperationFailed,
  offlineScope,
  markOperationsSynced,
  replaceWithServerSnapshot,
  resetFailedOperations,
  saveOfflineProfile,
  saveStoreName,
  saveStockConflicts,
  selectOfflineOrganization,
} from "../../../lib/offline-store";
import type { CommerceData, CommerceProfile, OutboxOperation } from "../../../lib/model";

const EMPTY_COMMERCE_DATA: CommerceData = { products: [], sales: [], expenses: [], cashSessions: [], stockConflicts: [] };

export function useCommerceSession(notify: (message: string) => void) {
  const [data, setData] = useState<CommerceData | null>(null);
  const [profile, setProfile] = useState<CommerceProfile | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [storeName, setStoreName] = useState("Minha Loja");
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedOperations, setFailedOperations] = useState<OutboxOperation[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const profileRef = useRef<CommerceProfile | null>(null);
  const syncsInProgress = useRef(new Set<string>());
  const syncAbortControllers = useRef(new Map<string, AbortController>());
  const syncCompletion = useRef(new Map<string, Promise<void>>());
  const savingDetails = useRef(false);

  const refreshLocalData = useCallback(async (scope: string) => {
    const [loaded, count, operations] = await Promise.all([
      loadCommerceData(scope),
      getPendingOperationCount(scope),
      getSyncOperations(true, scope),
    ]);
    if (!profileRef.current || offlineScope(profileRef.current) !== scope) return;
    setData(loaded);
    setPendingCount(count);
    setFailedOperations(operations.filter((operation) => operation.state === "failed"));
  }, []);

  const refreshPending = useCallback(async () => {
    const activeProfile = profileRef.current;
    if (!activeProfile?.enabledModules.includes("commerce")) return;
    try {
      const count = await getPendingOperationCount(offlineScope(activeProfile));
      if (profileRef.current?.id === activeProfile.id) setPendingCount(count);
    } catch {
      if (profileRef.current?.id === activeProfile.id) setStorageError("Não foi possível ler a fila local.");
    }
  }, []);

  const invalidateProfile = useCallback(async () => {
    await clearOfflineProfile();
    await selectOfflineOrganization(null);
    profileRef.current = null;
    setProfile(null);
    setData(null);
    setDeviceId("");
    setPendingCount(0);
    setFailedOperations([]);
    setAuthMessage("A sessão ou o acesso à loja expirou. Entre novamente para continuar.");
    setSyncMessage("");
  }, []);

  const activateProfile = useCallback(async (nextProfile: CommerceProfile, serverStoreName?: string, refreshOfflineSession = true) => {
    for (const controller of syncAbortControllers.current.values()) controller.abort();
    syncAbortControllers.current.clear();

    profileRef.current = null;
    setProfile(null);
    setData(null);
    setDeviceId("");
    setPendingCount(0);
    setFailedOperations([]);
    const scope = offlineScope(nextProfile);
    await selectOfflineOrganization(scope);

    if (nextProfile.enabledModules.includes("commerce")) {
      if (nextProfile.role === "admin") await adoptLegacyOperations(nextProfile.id, scope);
      const [localData, count, operations, localDeviceId, cachedStoreName] = await Promise.all([
        loadCommerceData(scope),
        getPendingOperationCount(scope),
        getSyncOperations(true, scope),
        getDeviceId(scope),
        loadStoreName(scope),
      ]);
      setData(localData);
      setPendingCount(count);
      setFailedOperations(operations.filter((operation) => operation.state === "failed"));
      setDeviceId(localDeviceId);
      const nextStoreName = serverStoreName || cachedStoreName;
      setStoreName(nextStoreName);
      if (serverStoreName) await saveStoreName(serverStoreName, scope);
    } else {
      setData(EMPTY_COMMERCE_DATA);
      setPendingCount(0);
      const cachedStoreName = await loadStoreName(scope);
      setStoreName(serverStoreName || cachedStoreName);
      if (serverStoreName) await saveStoreName(serverStoreName, scope);
    }

    if (refreshOfflineSession) await saveOfflineProfile(nextProfile);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setAuthMessage("");
  }, []);

  const syncNow = useCallback(async (activeProfile: CommerceProfile, includeFailed = false) => {
    const scope = offlineScope(activeProfile);
    if (!navigator.onLine || savingDetails.current || !activeProfile.enabledModules.includes("commerce") || syncsInProgress.current.has(scope)) return;
    if (profileRef.current?.id !== activeProfile.id || !isOfflineOrganizationActive(scope)) return;

    const controller = new AbortController();
    syncAbortControllers.current.set(scope, controller);
    syncsInProgress.current.add(scope);
    let finishSync!: () => void;
    const completion = new Promise<void>((resolve) => { finishSync = resolve; });
    syncCompletion.current.set(scope, completion);
    const isCurrentProfile = () => profileRef.current?.id === activeProfile.id
      && offlineScope(profileRef.current) === scope;
    setSyncMessage("A sincronizar…");
    try {
      if (includeFailed) await resetFailedOperations(scope);
      const queuedOperations = await getSyncOperations(true, scope);
      const firstFailedIndex = queuedOperations.findIndex((operation) => operation.state === "failed");
      const queueBlockedByFailure = firstFailedIndex !== -1;
      const operations = queueBlockedByFailure ? queuedOperations.slice(0, firstFailedIndex) : queuedOperations;
      let rejectedCount = 0;
      let retryableCount = 0;
      let deferredCount = 0;
      if (!isCurrentProfile()) return;
      if (operations.length > 0) {
        const response = await fetch("/api/commerce/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operations }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
        });
        if (response.status === 401 || response.status === 403) {
          if (isCurrentProfile()) await invalidateProfile();
          return;
        }
        if (!response.ok) throw new Error("O servidor não recebeu a fila. Os registos permanecem guardados neste dispositivo.");
        const result = await response.json() as {
          results: Array<{ id: string; status: "accepted" | "duplicate" | "conflict" | "rejected"; conflicts?: CommerceData["stockConflicts"]; error?: string; retryable?: boolean }>;
          syncedAt: string;
        };
        deferredCount = Math.max(0, operations.length - result.results.length);
        const acceptedIds: string[] = [];
        const newConflicts: CommerceData["stockConflicts"] = [];
        for (const item of result.results) {
          if (item.status === "accepted" || item.status === "duplicate" || item.status === "conflict") {
            acceptedIds.push(item.id);
            newConflicts.push(...(item.conflicts ?? []));
          } else if (!item.retryable) {
            await markOperationFailed(item.id, item.error ?? "Operação rejeitada pelo servidor.", scope);
            rejectedCount += 1;
          } else {
            retryableCount += 1;
          }
        }
        await markOperationsSynced(acceptedIds, scope);
        if (newConflicts.length > 0) {
          const current = await loadCommerceData(scope);
          const merged = new Map(current.stockConflicts.map((conflict) => [conflict.id, conflict]));
          for (const conflict of newConflicts) merged.set(conflict.id, conflict);
          await saveStockConflicts([...merged.values()], scope);
        }
        if (isCurrentProfile()) setLastSyncAt(result.syncedAt);
      }

      if (!isCurrentProfile()) return;
      const snapshotResponse = await fetch("/api/commerce/snapshot", {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
      });
      if (!snapshotResponse.ok) {
        if (snapshotResponse.status === 401 || snapshotResponse.status === 403) {
          if (isCurrentProfile()) await invalidateProfile();
        } else throw new Error("As operações foram enviadas, mas não foi possível atualizar o catálogo.");
      } else {
        const snapshot = await snapshotResponse.json() as { data: CommerceData; syncedAt: string; profile: CommerceProfile; organization?: { name: string } };
        if (snapshot.profile.id !== activeProfile.id || offlineScope(snapshot.profile) !== scope) {
          if (isCurrentProfile()) await invalidateProfile();
          return;
        }
        if (!isCurrentProfile()) return;
        await replaceWithServerSnapshot(snapshot.data, scope);
        if (isCurrentProfile()) {
          profileRef.current = snapshot.profile;
          setProfile(snapshot.profile);
          await saveOfflineProfile(snapshot.profile);
        }
        if (snapshot.organization?.name) {
          await saveStoreName(snapshot.organization.name, scope);
          if (isCurrentProfile()) setStoreName(snapshot.organization.name);
        }
        if (isCurrentProfile()) {
          setLastSyncAt(snapshot.syncedAt);
          setSyncMessage(snapshot.data.stockConflicts.length > 0
            ? `${snapshot.data.stockConflicts.length} divergência(s) de stock precisam de reconciliação.`
            : rejectedCount > 0
              ? `${rejectedCount} operação(ões) falharam.${deferredCount ? ` ${deferredCount} operação(ões) seguintes aguardam correção para preservar a ordem.` : " Consulte a fila e tente novamente após corrigir os dados."}`
              : queueBlockedByFailure
                ? "A fila automática aguarda a correção de uma operação com falha. As operações seguintes continuam guardadas neste dispositivo."
                : deferredCount > 0
                  ? `${deferredCount} operação(ões) aguardam a conclusão de uma operação anterior. A fila tentará novamente.`
                  : retryableCount > 0
                    ? "O servidor está temporariamente indisponível. A fila será tentada novamente."
                    : "Dados sincronizados.");
        }
      }
      if (isCurrentProfile()) await refreshLocalData(scope);
    } catch (error) {
      if (!controller.signal.aborted && isCurrentProfile()) {
        setSyncMessage(error instanceof Error ? error.message : "Falha de sincronização. Os registos locais foram preservados.");
      }
    } finally {
      if (syncAbortControllers.current.get(scope) === controller) syncAbortControllers.current.delete(scope);
      syncsInProgress.current.delete(scope);
      if (syncCompletion.current.get(scope) === completion) syncCompletion.current.delete(scope);
      finishSync();
    }
  }, [invalidateProfile, refreshLocalData]);

  const updateStoreSettings = useCallback(async (details: { storeName: string; ownerName: string } | { email: string }) => {
    const current = profileRef.current;
    if (!current || !navigator.onLine) throw new Error("Ligue-se à internet para alterar os dados da loja.");
    if (savingDetails.current) throw new Error("Já existe uma alteração em curso.");
    savingDetails.current = true;
    try {
      syncAbortControllers.current.get(offlineScope(current))?.abort();
      await syncCompletion.current.get(offlineScope(current));
      if (profileRef.current?.id !== current.id || profileRef.current.organizationId !== current.organizationId) throw new Error("A sessão mudou. Entre novamente e tente guardar.");
      const response = await fetch("/api/commerce/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json() as { storeName?: string; ownerName?: string; email?: string; error?: { message?: string } };
      if (!response.ok || ("email" in details ? !result.email : !result.storeName || !result.ownerName)) throw new Error(result.error?.message ?? "Não foi possível guardar os dados.");
      if (profileRef.current?.id !== current.id || profileRef.current.organizationId !== current.organizationId) return;
      const updatedProfile = { ...profileRef.current, name: result.ownerName ?? profileRef.current.name, email: result.email ?? profileRef.current.email };
      profileRef.current = updatedProfile;
      setProfile(updatedProfile);
      if (result.storeName) setStoreName(result.storeName);
      try {
        await Promise.all([result.storeName && saveStoreName(result.storeName, offlineScope(current)), saveOfflineProfile(updatedProfile)]);
      } catch {
        setStorageError("Os dados foram guardados no servidor, mas não foi possível actualizar a cópia local.");
      }
      notify(result.email ? "E-mail de acesso actualizado." : "Dados da loja actualizados.");
    } finally {
      savingDetails.current = false;
      if (profileRef.current?.id === current.id) void syncNow(profileRef.current);
    }
  }, [notify, syncNow]);

  const acceptProfile = useCallback(async (nextProfile: CommerceProfile, serverStoreName?: string) => {
    await activateProfile(nextProfile, serverStoreName);
    await syncNow(nextProfile);
  }, [activateProfile, syncNow]);

  const signOut = useCallback(async () => {
    if (!online) {
      notify("Ligue-se à internet antes de terminar a sessão.");
      return;
    }
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("O servidor não confirmou o fim da sessão.");
      for (const controller of syncAbortControllers.current.values()) controller.abort();
      syncAbortControllers.current.clear();
      await clearOfflineProfile();
      await selectOfflineOrganization(null);
      profileRef.current = null;
      setProfile(null);
      setData(null);
      setDeviceId("");
      setPendingCount(0);
      setFailedOperations([]);
      setAuthMessage("Sessão terminada. Entre novamente para continuar.");
    } catch {
      notify("Não foi possível terminar a sessão no servidor.");
    }
  }, [notify, online]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let active = true;

    async function activateCachedProfile(cachedProfile: CommerceProfile, message: string) {
      await activateProfile(cachedProfile, undefined, false);
      if (active) setSyncMessage(message);
      if (active && !cachedProfile.enabledModules.includes("commerce")) setSyncMessage("Este módulo está disponível quando a plataforma o lançar.");
    }

    async function start() {
      let validatedSessionUserId: string | null = null;
      try {
        const localProfile = await loadOfflineProfile();
        if (!active) return;
        if (navigator.onLine) {
          try {
            const response = await fetch("/api/auth/get-session", {
              cache: "no-store",
              signal: AbortSignal.timeout(4_000),
            });
            if (response.ok) {
              const sessionResult = await response.json() as { user?: { id?: unknown } | null } | null;
              validatedSessionUserId = typeof sessionResult?.user?.id === "string" ? sessionResult.user.id : null;
              if (!validatedSessionUserId) {
                await clearOfflineProfile();
                setAuthMessage("Entre com as credenciais da sua conta para continuar.");
                return;
              }
              const profileResponse = await fetch("/api/commerce/profile", {
                cache: "no-store",
                signal: AbortSignal.timeout(4_000),
              });
              if (profileResponse.ok) {
                const result = await profileResponse.json() as { profile: CommerceProfile; organization?: { name: string } };
                if (!active) return;
                await activateProfile(result.profile, result.organization?.name);
                if (result.profile.enabledModules.includes("commerce")) await syncNow(result.profile);
                else setSyncMessage("Os módulos de Serviços e Formação ficarão disponíveis numa fase futura.");
              } else if (profileResponse.status === 403) {
                let isPlatformAdministrator = false;
                try {
                  const platformResponse = await fetch("/api/platform/session", { cache: "no-store", signal: AbortSignal.timeout(4_000) });
                  isPlatformAdministrator = platformResponse.ok;
                } catch {
                  isPlatformAdministrator = false;
                }
                if (isPlatformAdministrator) {
                  await clearOfflineProfile();
                  window.location.replace("/plataforma");
                  return;
                }
                await clearOfflineProfile();
                setAuthMessage("Esta conta não tem acesso activo a uma loja. Contacte o administrador da plataforma.");
              } else if (profileResponse.status === 401) {
                await clearOfflineProfile();
                setAuthMessage("A sessão expirou. Entre novamente para continuar.");
              } else if (localProfile?.id === validatedSessionUserId) {
                await activateCachedProfile(localProfile, "Servidor indisponível. Pode continuar com os dados locais.");
              } else {
                await clearOfflineProfile();
                setAuthMessage("Não foi possível carregar o perfil da loja.");
              }
            } else if (response.status === 401) {
              await clearOfflineProfile();
              setAuthMessage("A sessão expirou. Entre novamente para continuar.");
            } else if (localProfile) {
              await activateCachedProfile(localProfile, "Servidor indisponível. Pode continuar com os dados locais.");
            } else {
              setAuthMessage("Não foi possível contactar o servidor. A primeira autenticação requer ligação.");
            }
          } catch {
            if (localProfile && (!validatedSessionUserId || localProfile.id === validatedSessionUserId)) {
              await activateCachedProfile(localProfile, "Sem ligação ao servidor. Pode continuar com os dados locais.");
            } else {
              await clearOfflineProfile();
              setAuthMessage("A primeira autenticação precisa de internet.");
            }
          }
        } else if (localProfile) {
          await activateCachedProfile(localProfile, "Modo offline. As alterações ficarão pendentes neste dispositivo.");
        } else {
          setAuthMessage("A primeira autenticação precisa de internet.");
        }
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : "Erro ao abrir dados locais.");
        setAuthMessage("Não foi possível abrir os dados guardados neste dispositivo.");
      } finally {
        if (active) setAuthReady(true);
      }
    }

    function handleOnline() {
      setOnline(true);
      if (profileRef.current) void syncNow(profileRef.current);
    }

    function handleOffline() {
      setOnline(false);
      if (profileRef.current?.enabledModules.includes("commerce")) setSyncMessage("Modo offline. As alterações ficarão pendentes neste dispositivo.");
    }

    const nowTimer = window.setTimeout(() => setClientNow(new Date()), 0);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void start();

    return () => {
      active = false;
      window.clearTimeout(nowTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [activateProfile, syncNow]);

  useEffect(() => {
    if (!profile || !online || !profile.enabledModules.includes("commerce")) return;
    const syncOnFocus = () => {
      if (document.visibilityState === "visible") void syncNow(profile);
    };
    const interval = window.setInterval(() => void syncNow(profile), 15_000);
    document.addEventListener("visibilitychange", syncOnFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncOnFocus);
    };
  }, [profile, online, syncNow]);

  return {
    data,
    setData,
    profile,
    deviceId,
    storeName,
    authReady,
    authMessage,
    clientNow,
    online,
    pendingCount,
    failedOperations,
    lastSyncAt,
    syncMessage,
    storageError,
    refreshLocalData,
    refreshPending,
    syncNow,
    updateStoreSettings,
    acceptProfile,
    signOut,
  };
}
