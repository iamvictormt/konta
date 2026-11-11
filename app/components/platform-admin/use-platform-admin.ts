"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateStoreInput, FinancialSummary, PlatformStore } from "./types";

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

export function usePlatformAdmin() {
  const [stores, setStores] = useState<PlatformStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStoreId, setBusyStoreId] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedStore, setSelectedStore] = useState<PlatformStore | null>(null);
  const [creatingStore, setCreatingStore] = useState(false);
  const [createStoreOpen, setCreateStoreOpen] = useState(false);
  const [financialStore, setFinancialStore] = useState<PlatformStore | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const storeResponse = await fetch("/api/platform/stores", { cache: "no-store" });
      if (!storeResponse.ok) throw new Error(await readError(storeResponse, "Não foi possível carregar as lojas."));
      const storeResult = await storeResponse.json() as { stores: PlatformStore[] };
      setStores(storeResult.stores);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar a administração da Kontá.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!financialSummary) return;
    const timeout = window.setTimeout(() => {
      setFinancialSummary(null);
      setFinancialStore(null);
      setNotice("O acesso temporário expirou. Abra uma nova autorização para voltar a consultar o resumo.");
    }, Math.max(0, new Date(financialSummary.expiresAt).getTime() - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [financialSummary]);

  useEffect(() => {
    const expirations = stores.flatMap((store) => store.supportAccess ? [new Date(store.supportAccess.expiresAt).getTime()] : []);
    if (expirations.length === 0) return;
    const nextExpiry = Math.min(...expirations);
    const timer = window.setTimeout(() => { void refresh(); }, Math.max(0, nextExpiry - Date.now()) + 250);
    return () => window.clearTimeout(timer);
  }, [refresh, stores]);

  async function viewFinancials(store: PlatformStore) {
    setBusyStoreId(store.id);
    setNotice("");
    try {
      const response = await fetch(`/api/platform/stores/${encodeURIComponent(store.id)}/financial-summary`, { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível consultar os dados financeiros."));
      const result = await response.json() as { summary: FinancialSummary };
      setFinancialStore(store);
      setFinancialSummary(result.summary);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível consultar os dados financeiros.");
    } finally {
      setBusyStoreId("");
    }
  }

  async function grantAccess(reason: string, durationMinutes: 15 | 30 | 60) {
    if (!selectedStore) return;
    const store = selectedStore;
    setBusyStoreId(store.id);
    setNotice("");
    try {
      const response = await fetch("/api/platform/support-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: store.id, reason, durationMinutes }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível abrir o acesso de suporte."));
      setSelectedStore(null);
      await refresh();
      await viewFinancials({ ...store, supportAccess: { id: "pending", reason, expiresAt: new Date(Date.now() + durationMinutes * 60_000).toISOString() } });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir o acesso de suporte.");
    } finally {
      setBusyStoreId("");
    }
  }

  async function revokeAccess(store: PlatformStore) {
    if (!store.supportAccess) return;
    setBusyStoreId(store.id);
    setNotice("");
    try {
      const response = await fetch(`/api/platform/support-access/${encodeURIComponent(store.supportAccess.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível encerrar o acesso."));
      setFinancialSummary(null);
      setFinancialStore(null);
      setNotice(`O acesso financeiro a ${store.name} foi encerrado.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível encerrar o acesso.");
    } finally {
      setBusyStoreId("");
    }
  }

  async function createStore(input: CreateStoreInput) {
    setCreatingStore(true);
    setNotice("");
    try {
      const response = await fetch("/api/platform/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível criar a conta da loja."));
      setCreateStoreOpen(false);
      setNotice(`A loja ${input.storeName} e a conta de acesso foram criadas.`);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a conta da loja.";
      setNotice(message);
      throw new Error(message);
    } finally {
      setCreatingStore(false);
    }
  }

  async function setStoreActive(store: PlatformStore, active: boolean) {
    setBusyStoreId(store.id);
    setNotice("");
    try {
      const response = await fetch("/api/platform/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, active }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível alterar o estado da conta."));
      setNotice(active ? `A conta de ${store.name} foi reactivada.` : `A conta de ${store.name} foi desactivada.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível alterar o estado da conta.");
    } finally {
      setBusyStoreId("");
    }
  }

  return {
    stores,
    loading,
    busyStoreId,
    notice,
    selectedStore,
    setSelectedStore,
    creatingStore,
    createStoreOpen,
    setCreateStoreOpen,
    financialStore,
    financialSummary,
    refresh,
    viewFinancials,
    grantAccess,
    revokeAccess,
    createStore,
    setStoreActive,
  };
}
