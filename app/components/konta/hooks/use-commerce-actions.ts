import type { Dispatch, SetStateAction } from "react";
import {
  createId,
  saveCashSessionClose,
  saveCashSessionOpen,
  saveExpense,
  saveProduct,
  saveSaleAndProducts,
} from "../../../lib/offline-store";
import type { CashSession, CommerceData, CommerceProfile, Expense, Product, Sale } from "../../../lib/model";
import type { SaleCartLine } from "../types";
import { money } from "../format";

type CommerceActionsOptions = {
  data: CommerceData | null;
  setData: Dispatch<SetStateAction<CommerceData | null>>;
  profile: CommerceProfile | null;
  deviceId: string;
  online: boolean;
  activeCashSession: CashSession | null;
  cashBalance: number;
  cartCount: number;
  cartLines: SaleCartLine[];
  cartTotal: number;
  receivedAmount: number;
  changeAmount: number;
  refreshPending: () => Promise<void>;
  syncNow: (profile: CommerceProfile, includeFailed?: boolean) => Promise<void>;
  clearCart: () => void;
  closeModal: () => void;
  notify: (message: string) => void;
};

export function useCommerceActions({
  data,
  setData,
  profile,
  deviceId,
  online,
  activeCashSession,
  cashBalance,
  cartCount,
  cartLines,
  cartTotal,
  receivedAmount,
  changeAmount,
  refreshPending,
  syncNow,
  clearCart,
  closeModal,
  notify,
}: CommerceActionsOptions) {
  const products = data?.products ?? [];
  const sales = data?.sales ?? [];

  async function saveCatalogProduct(product: Omit<Product, "id">, photo?: { file: File; productId: string }, editingId?: string) {
    if (!profile || profile.role !== "admin") return;
    if (!online) {
      notify("Os produtos só podem ser alterados quando a loja estiver online.");
      return;
    }
    const existing = products.find((item) => item.id === editingId);
    if (editingId && !existing) {
      notify("Este produto já não está no catálogo.");
      return;
    }
    if (products.some((item) => item.id !== editingId && item.sku.toLocaleLowerCase() === product.sku.toLocaleLowerCase())) {
      notify("Já existe um produto com esse código nesta loja.");
      return;
    }
    const record: Product = { ...product, id: existing?.id ?? photo?.productId ?? createId(), stock: existing?.stock ?? product.stock };
    try {
      if (photo) {
        const response = await fetch("/api/commerce/products/image?productId=" + encodeURIComponent(record.id), {
          method: "POST",
          headers: { "Content-Type": photo.file.type },
          body: photo.file,
          signal: AbortSignal.timeout(45_000),
        });
        const result = await response.json() as { imageUrl?: string; error?: string };
        if (!response.ok || !result.imageUrl) throw new Error(result.error ?? "Não foi possível carregar a foto.");
        record.imageUrl = result.imageUrl;
      }
      await saveProduct(record, profile.id, profile.organizationId, Boolean(existing));
      setData((current) => current ? { ...current, products: existing ? current.products.map((item) => item.id === record.id ? { ...record, stock: item.stock } : item) : [record, ...current.products] } : current);
      await refreshPending();
      closeModal();
      notify("Produto guardado neste dispositivo.");
      if (online) void syncNow(profile);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível guardar o produto.");
    }
  }

  async function openCashSession(openingAmount: number) {
    if (!profile || !deviceId) return;
    if (activeCashSession) {
      notify("Este dispositivo já tem uma sessão de caixa aberta.");
      return;
    }
    if (!Number.isSafeInteger(openingAmount) || openingAmount < 0 || openingAmount > 2_000_000_000) {
      notify("Introduza um fundo inicial inteiro entre 0 e 2.000.000.000 Db.");
      return;
    }

    const session: CashSession = {
      id: createId(),
      deviceId,
      openedBy: profile.id,
      openedByName: profile.name,
      openedAt: new Date().toISOString(),
      openingAmount,
      status: "open",
      syncState: "pending",
    };
    try {
      await saveCashSessionOpen(session, profile.id, profile.organizationId);
      setData((current) => current ? { ...current, cashSessions: [session, ...current.cashSessions] } : current);
      await refreshPending();
      notify(online ? "Caixa aberto. A sessão foi guardada neste dispositivo." : "Caixa aberto offline. A sessão será sincronizada quando a ligação regressar.");
      if (online) void syncNow(profile);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível abrir o caixa.");
    }
  }

  async function closeCashSession(countedAmount: number) {
    if (!profile || !activeCashSession) return;
    if (cartCount > 0) {
      notify("Conclua a venda atual antes de fechar o caixa.");
      return;
    }
    if (!Number.isSafeInteger(countedAmount) || countedAmount < 0 || countedAmount > 2_000_000_000) {
      notify("Introduza um valor contado inteiro entre 0 e 2.000.000.000 Db.");
      return;
    }

    const expectedAmount = cashBalance;
    const differenceAmount = countedAmount - expectedAmount;
    if (!Number.isSafeInteger(expectedAmount) || !Number.isSafeInteger(differenceAmount)) {
      notify("Os valores desta sessão excedem o limite numérico suportado.");
      return;
    }
    const closedAt = new Date().toISOString();
    const closedSession: CashSession = {
      ...activeCashSession,
      status: "closed",
      closedBy: profile.id,
      closedByName: profile.name,
      closedAt,
      expectedAmount,
      countedAmount,
      differenceAmount,
      syncState: "pending",
    };
    try {
      await saveCashSessionClose(closedSession, profile.id, profile.organizationId);
      setData((current) => current ? {
        ...current,
        cashSessions: current.cashSessions.map((session) => session.id === closedSession.id ? closedSession : session),
      } : current);
      await refreshPending();
      notify(online ? "Fecho de caixa guardado." : "Fecho guardado offline e pendente de sincronização.");
      if (online) void syncNow(profile);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível fechar o caixa.");
    }
  }

  async function createExpense(expense: Omit<Expense, "id" | "createdAt" | "syncState">) {
    if (!profile) return;
    if (!activeCashSession) {
      notify("Abra uma sessão de caixa antes de lançar despesas.");
      return;
    }
    const record: Expense = {
      ...expense,
      cashSessionId: activeCashSession.id,
      id: createId(),
      createdAt: new Date().toISOString(),
      syncState: "pending",
    };
    try {
      await saveExpense(record, profile.id, profile.organizationId);
      setData((current) => current ? {
        ...current,
        expenses: [record, ...current.expenses],
        cashSessions: current.cashSessions.map((session) => session.id === activeCashSession.id && session.syncState !== "failed" ? { ...session, syncState: "pending" } : session),
      } : current);
      await refreshPending();
      closeModal();
      notify("Despesa guardada localmente e marcada como pendente.");
      if (online) void syncNow(profile);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível guardar a despesa.");
    }
  }

  async function finishSale() {
    if (!profile || !data || cartLines.length === 0 || receivedAmount < cartTotal) return;
    if (!activeCashSession) {
      notify("Abra uma sessão de caixa antes de registar vendas.");
      return;
    }
    if (!Number.isSafeInteger(receivedAmount)) {
      notify("Introduza o valor recebido em Db inteiros.");
      return;
    }
    const updatedProducts = products.map((product) => {
      const line = cartLines.find((item) => item.product.id === product.id);
      return line ? { ...product, stock: Math.max(0, product.stock - line.quantity) } : product;
    });
    const sale: Sale = {
      id: createId(),
      createdAt: new Date().toISOString(),
      cashSessionId: activeCashSession.id,
      items: cartLines.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price,
        unitCost: product.cost,
      })),
      total: cartTotal,
      received: receivedAmount,
      change: changeAmount,
      syncState: "pending",
    };

    try {
      await saveSaleAndProducts(sale, updatedProducts, profile.id, profile.organizationId);
      setData({
        ...data,
        products: updatedProducts,
        sales: [sale, ...sales],
        cashSessions: data.cashSessions.map((session) => session.id === activeCashSession.id && session.syncState !== "failed" ? { ...session, syncState: "pending" } : session),
      });
      clearCart();
      await refreshPending();
      notify("Venda guardada localmente. Troco: " + money(changeAmount));
      if (online) void syncNow(profile);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível guardar a venda.");
    }
  }

  return { saveCatalogProduct, openCashSession, closeCashSession, createExpense, finishSale };
}
