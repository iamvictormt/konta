"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./ui-icon";
import FormField from "./ui/form-field";
import CustomSelect, { type CustomSelectOption } from "./ui/custom-select";
import MaskedNumberInput from "./ui/masked-number-input";
import {
  adoptLegacyOperations,
  clearOfflineProfile,
  getSyncOperations,
  getPendingOperationCount,
  loadOfflineProfile,
  loadCommerceData,
  markOperationFailed,
  markOperationsSynced,
  replaceWithServerSnapshot,
  resetFailedOperations,
  saveOfflineProfile,
  saveStockConflicts,
  loadStoreName,
  saveStoreName,
  saveExpense,
  saveProduct,
  saveSaleAndProducts,
} from "../lib/offline-store";
import { OPENING_CASH, type CommerceData, type CommerceProfile, type Expense, type OutboxOperation, type Product, type Sale } from "../lib/model";

type Section = "inicio" | "vendas" | "produtos" | "relatorios" | "caixa" | "definicoes";
type ModalKind = "product" | "expense" | null;
type CartLine = { productId: string; quantity: number };
type ChartRange = "week" | "month" | "year";
type HeaderPopover = "store" | "connection" | "profile" | null;

const navItems: Array<{ id: Section; label: string; icon: IconName }> = [
  { id: "inicio", label: "Início", icon: "home" },
  { id: "vendas", label: "Vendas", icon: "cart" },
  { id: "produtos", label: "Produtos", icon: "box" },
  { id: "relatorios", label: "Relatórios", icon: "chart" },
  { id: "caixa", label: "Caixa", icon: "cash" },
  { id: "definicoes", label: "Definições", icon: "settings" },
];

const sectionPaths: Record<Section, string> = {
  inicio: "/",
  vendas: "/vendas",
  produtos: "/produtos",
  relatorios: "/relatorios",
  caixa: "/caixa",
  definicoes: "/definicoes",
};

const pathSections: Record<string, Section> = Object.fromEntries(
  Object.entries(sectionPaths).map(([section, path]) => [path, section]),
) as Record<string, Section>;

const productSymbolOptions: CustomSelectOption[] = ["📦", "🧺", "🏺", "👜", "🎭", "📿"].map((symbol) => ({
  value: symbol,
  label: symbol,
}));

const expenseCategoryOptions: CustomSelectOption[] = ["Operação", "Logística", "Renda", "Serviços", "Outra"].map((category) => ({
  value: category,
  label: category,
}));

const todayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function money(value: number) {
  const formatted = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(value);
  return `${formatted.replaceAll("\u00a0", ".")} Db`;
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dayLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-PT", options).format(date);
}

function greeting(date: Date | null) {
  const hour = date?.getHours() ?? 9;
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function profileFromSession(value: unknown): CommerceProfile | null {
  if (!value || typeof value !== "object") return null;
  const session = value as { user?: Record<string, unknown> };
  const user = session.user;
  if (!user || typeof user.id !== "string" || typeof user.name !== "string" || typeof user.email !== "string") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "collaborator",
    organizationId: typeof user.organizationId === "string" ? user.organizationId : "default",
  };
}

function AuthScreen({ online, initialMessage, onSignedIn }: { online: boolean; initialMessage: string; onSignedIn: (profile: CommerceProfile) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setMessage("A primeira autenticação precisa de internet. Ligue-se e tente novamente.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        setMessage(response.status === 401 || response.status === 400
          ? "E-mail ou palavra-passe incorretos."
          : "Não foi possível iniciar sessão. Tente novamente mais tarde.");
        return;
      }
      const signedIn = profileFromSession(await response.json());
      if (!signedIn) {
        setMessage("A sessão foi criada, mas o perfil da loja não pôde ser carregado.");
        return;
      }
      onSignedIn(signedIn);
    } catch {
      setMessage("Sem ligação ao servidor. Confirme a internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-screen">
    <div className="auth-card">
      <div className="auth-brand">
        <div className="brand-logo-frame auth-logo-frame">
          <Image src="/images/konta-logo.svg" alt="Kontá — Gestão simples. Negócios fortes." width={1152} height={512} sizes="260px" loading="eager" />
        </div>
      </div>
      <h1>Bem-vindo à Kontá</h1>
      <p className="auth-intro">Entre com as credenciais fornecidas pelo administrador.</p>
      {message && <div className="auth-message" role="alert">{message}</div>}
      {!online && <div className="auth-message">Este dispositivo ainda não tem uma sessão offline válida. A primeira autenticação exige internet.</div>}
      <form onSubmit={submit}>
        <FormField id="auth-email" label="E-mail"><input id="auth-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField id="auth-password" label="Palavra-passe"><input id="auth-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting || !online}>{submitting ? "A entrar…" : "Entrar"}</button>
      </form>
      <p className="auth-footnote">Os dados deste dispositivo só ficam acessíveis depois de uma autenticação online válida.</p>
    </div>
  </main>;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function bucketize(sales: Sale[], range: ChartRange, now: Date) {
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];

  if (range === "week") {
    for (let index = 6; index >= 0; index -= 1) {
      const day = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - index));
      const end = new Date(day.getTime() + 86_400_000);
      buckets.push({ label: dayLabel(day, { weekday: "short" }).replace(".", ""), start: day, end });
    }
  } else if (range === "month") {
    for (let index = 6; index >= 0; index -= 1) {
      const end = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - index * 4));
      const start = startOfDay(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 3));
      buckets.push({ label: dayLabel(start, { day: "numeric" }), start, end: new Date(end.getTime() + 86_400_000) });
    }
  } else {
    for (let index = 6; index >= 0; index -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - index + 1, 1);
      buckets.push({ label: dayLabel(start, { month: "short" }).replace(".", ""), start, end });
    }
  }

  return buckets.map((bucket) => {
    const value = sales
      .filter((sale) => {
        const timestamp = new Date(sale.createdAt).getTime();
        return timestamp >= bucket.start.getTime() && timestamp < bucket.end.getTime();
      })
      .reduce((total, sale) => total + sale.total, 0);
    return { label: bucket.label, value };
  });
}

export default function KontaApp() {
  const pathname = usePathname();
  const section = pathSections[pathname] ?? "inicio";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerPopover, setHeaderPopover] = useState<HeaderPopover>(null);
  const [data, setData] = useState<CommerceData | null>(null);
  const [profile, setProfile] = useState<CommerceProfile | null>(null);
  const [storeName, setStoreName] = useState("Minha Loja");
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedOperations, setFailedOperations] = useState<OutboxOperation[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const syncInProgress = useRef(false);
  const profileRef = useRef<CommerceProfile | null>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState("");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [amountReceived, setAmountReceived] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("week");

  const refreshLocalData = useCallback(async () => {
    const [loaded, count, operations] = await Promise.all([loadCommerceData(), getPendingOperationCount(), getSyncOperations(true)]);
    setData(loaded);
    setPendingCount(count);
    setFailedOperations(operations.filter((operation) => operation.state === "failed"));
  }, []);

  const syncNow = useCallback(async (activeProfile: CommerceProfile, includeFailed = false) => {
    if (!navigator.onLine || syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncMessage("A sincronizar…");
    try {
      if (includeFailed) await resetFailedOperations();
      const operations = await getSyncOperations();
      let rejectedCount = 0;
      let retryableCount = 0;
      if (operations.length > 0) {
        const response = await fetch("/api/commerce/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operations }),
          signal: AbortSignal.timeout(8_000),
        });
        if (response.status === 401) {
          setSyncMessage("A sessão precisa de nova autenticação para sincronizar.");
          await refreshLocalData();
          return;
        }
        if (!response.ok) throw new Error("O servidor não recebeu a fila. Os registos permanecem guardados neste dispositivo.");
        const result = await response.json() as {
          results: Array<{ id: string; status: "accepted" | "duplicate" | "conflict" | "rejected"; conflicts?: CommerceData["stockConflicts"]; error?: string; retryable?: boolean }>;
          syncedAt: string;
        };
        const acceptedIds: string[] = [];
        const newConflicts: CommerceData["stockConflicts"] = [];
        for (const item of result.results) {
          if (item.status === "accepted" || item.status === "duplicate" || item.status === "conflict") {
            acceptedIds.push(item.id);
            newConflicts.push(...(item.conflicts ?? []));
          } else if (!item.retryable) {
            await markOperationFailed(item.id, item.error ?? "Operação rejeitada pelo servidor.");
            rejectedCount += 1;
          } else {
            retryableCount += 1;
          }
        }
        await markOperationsSynced(acceptedIds);
        if (newConflicts.length > 0) {
          const current = await loadCommerceData();
          const merged = new Map(current.stockConflicts.map((conflict) => [conflict.id, conflict]));
          for (const conflict of newConflicts) merged.set(conflict.id, conflict);
          await saveStockConflicts([...merged.values()]);
        }
        setLastSyncAt(result.syncedAt);
      }

      const snapshotResponse = await fetch("/api/commerce/snapshot", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!snapshotResponse.ok) {
        if (snapshotResponse.status === 401) setSyncMessage("A sessão precisa de nova autenticação para atualizar os dados.");
        else throw new Error("As operações foram enviadas, mas não foi possível atualizar o catálogo.");
      } else {
        const snapshot = await snapshotResponse.json() as { data: CommerceData; syncedAt: string; organization?: { name: string } };
        await replaceWithServerSnapshot(snapshot.data);
        if (snapshot.organization?.name) {
          setStoreName(snapshot.organization.name);
          await saveStoreName(snapshot.organization.name);
        }
        setLastSyncAt(snapshot.syncedAt);
        setSyncMessage(snapshot.data.stockConflicts.length > 0
          ? `${snapshot.data.stockConflicts.length} divergência(s) de stock precisam de reconciliação.`
          : rejectedCount > 0
            ? `${rejectedCount} operação(ões) falharam. Consulte a fila e tente novamente após corrigir os dados.`
            : retryableCount > 0
              ? "O servidor está temporariamente indisponível. A fila será tentada novamente."
              : "Dados sincronizados.");
      }
      await refreshLocalData();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Falha de sincronização. Os registos locais foram preservados.");
    } finally {
      syncInProgress.current = false;
    }
  }, [refreshLocalData]);

  const acceptProfile = useCallback(async (nextProfile: CommerceProfile) => {
    await adoptLegacyOperations(nextProfile.id);
    await saveOfflineProfile(nextProfile);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setAuthMessage("");
    await syncNow(nextProfile);
  }, [syncNow]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (profile?.role !== "admin" && section === "relatorios") {
      setToast("Os relatórios financeiros estão disponíveis para o administrador.");
      window.history.replaceState(null, "", sectionPaths.inicio);
    }
  }, [profile?.role, section]);

  useEffect(() => {
    const tabletSidebar = window.matchMedia("(min-width: 651px) and (max-width: 900px)");
    const updateSidebarForViewport = (event: MediaQueryListEvent) => setSidebarCollapsed(event.matches);
    setSidebarCollapsed(tabletSidebar.matches);
    tabletSidebar.addEventListener("change", updateSidebarForViewport);
    return () => tabletSidebar.removeEventListener("change", updateSidebarForViewport);
  }, []);

  useEffect(() => {
    if (!headerPopover) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!topbarRef.current?.contains(event.target as Node)) setHeaderPopover(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setHeaderPopover(null);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [headerPopover]);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const [localData, localProfile, count, cachedStoreName] = await Promise.all([loadCommerceData(), loadOfflineProfile(), getPendingOperationCount(), loadStoreName()]);
        if (!active) return;
        setData(localData);
        setStoreName(cachedStoreName);
        setPendingCount(count);
        setFailedOperations((await getSyncOperations(true)).filter((operation) => operation.state === "failed"));
        if (navigator.onLine) {
          try {
            const response = await fetch("/api/auth/get-session", { cache: "no-store", signal: AbortSignal.timeout(4_000) });
            if (response.ok) {
              const currentProfile = profileFromSession(await response.json());
              if (currentProfile) {
                await adoptLegacyOperations(currentProfile.id);
                await saveOfflineProfile(currentProfile);
                if (!active) return;
                profileRef.current = currentProfile;
                setProfile(currentProfile);
                await syncNow(currentProfile);
              } else {
                await clearOfflineProfile();
                setAuthMessage("Entre com as credenciais da sua conta para continuar.");
              }
            } else if (response.status === 401) {
              await clearOfflineProfile();
              setAuthMessage("A sessão expirou. Entre novamente para continuar.");
            } else if (localProfile) {
              await adoptLegacyOperations(localProfile.id);
              profileRef.current = localProfile;
              setProfile(localProfile);
              setSyncMessage("Servidor indisponível. Pode continuar com os dados locais.");
            } else {
              setAuthMessage("Não foi possível contactar o servidor. A primeira autenticação requer ligação.");
            }
          } catch {
            if (localProfile) {
              await adoptLegacyOperations(localProfile.id);
              profileRef.current = localProfile;
              setProfile(localProfile);
              setSyncMessage("Sem ligação ao servidor. Pode continuar com os dados locais.");
            } else {
              setAuthMessage("A primeira autenticação precisa de internet.");
            }
          }
        } else if (localProfile) {
          await adoptLegacyOperations(localProfile.id);
          profileRef.current = localProfile;
          setProfile(localProfile);
          setSyncMessage("Modo offline. As alterações ficarão pendentes neste dispositivo.");
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

    const handleOnline = () => {
      setOnline(true);
      if (profileRef.current) void syncNow(profileRef.current);
    };
    const handleOffline = () => {
      setOnline(false);
      setSyncMessage("Modo offline. As alterações ficarão pendentes neste dispositivo.");
    };
    setClientNow(new Date());
    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void start();

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!profile || !online) return;
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const products = data?.products ?? [];
  const sales = data?.sales ?? [];
  const expenses = data?.expenses ?? [];
  const today = clientNow ? todayKey(clientNow) : "";
  const todaysSales = useMemo(
    () => sales.filter((sale) => todayKey(new Date(sale.createdAt)) === today),
    [sales, today],
  );
  const todaysExpenses = useMemo(
    () => expenses.filter((expense) => todayKey(new Date(expense.createdAt)) === today),
    [expenses, today],
  );
  const salesTotal = todaysSales.reduce((total, sale) => total + sale.total, 0);
  const expenseTotal = todaysExpenses.reduce((total, expense) => total + expense.amount, 0);
  const cashBalance = OPENING_CASH + salesTotal - expenseTotal;
  const chartData = useMemo(() => clientNow ? bucketize(sales, chartRange, clientNow) : [], [sales, chartRange, clientNow]);
  const chartMax = Math.max(1, ...chartData.map((point) => point.value));
  const chartTotal = chartData.reduce((total, point) => total + point.value, 0);
  const totalItems = products.reduce((total, product) => total + product.stock, 0);
  const sortedActivity = useMemo(() => [
    ...sales.map((sale) => ({ id: sale.id, createdAt: sale.createdAt, title: "Venda registada", detail: `${sale.items.length || 1} artigo${sale.items.length === 1 ? "" : "s"} · ${sale.syncState === "failed" ? "Falha" : sale.syncState === "pending" ? "Pendente" : "Sincronizada"}`, amount: sale.total, kind: "sale" as const })),
    ...expenses.map((expense) => ({ id: expense.id, createdAt: expense.createdAt, title: expense.description, detail: `${expense.category} · ${expense.syncState === "failed" ? "Falha" : expense.syncState === "pending" ? "Pendente" : "Sincronizada"}`, amount: expense.amount, kind: "expense" as const })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5), [sales, expenses]);

  async function refreshPending() {
    try {
      setPendingCount(await getPendingOperationCount());
    } catch {
      setStorageError("Não foi possível ler a fila local.");
    }
  }

  async function createProduct(product: Omit<Product, "id">) {
    if (!profile || profile.role !== "admin") return;
    if (!online) {
      setToast("Os produtos só podem ser criados quando a loja estiver online.");
      return;
    }
    if (products.some((item) => item.sku.toLocaleLowerCase() === product.sku.toLocaleLowerCase())) {
      setToast("Já existe um produto com esse código nesta loja.");
      return;
    }
    const record: Product = { ...product, id: createId() };
    try {
      await saveProduct(record, profile.id);
      setData((current) => current ? { ...current, products: [record, ...current.products] } : current);
      await refreshPending();
      setModal(null);
      setToast("Produto guardado neste dispositivo.");
      if (online) void syncNow(profile);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Não foi possível guardar o produto.");
    }
  }

  async function createExpense(expense: Omit<Expense, "id" | "createdAt" | "syncState">) {
    if (!profile) return;
    const record: Expense = { ...expense, id: createId(), createdAt: new Date().toISOString(), syncState: "pending" };
    try {
      await saveExpense(record, profile.id);
      setData((current) => current ? { ...current, expenses: [record, ...current.expenses] } : current);
      await refreshPending();
      setModal(null);
      setToast("Despesa guardada localmente e marcada como pendente.");
      if (online) void syncNow(profile);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Não foi possível guardar a despesa.");
    }
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product || product.stock < 1) return;
    const line = cart.find((item) => item.productId === productId);
    if (line && line.quantity >= product.stock) {
      setToast("A quantidade excede o stock deste dispositivo.");
      return;
    }
    setCart(line
      ? cart.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cart, { productId, quantity: 1 }]);
  }

  function changeQuantity(productId: string, delta: number) {
    const product = products.find((item) => item.id === productId);
    const line = cart.find((item) => item.productId === productId);
    if (delta > 0 && product && line && line.quantity >= product.stock) {
      setToast("A quantidade excede o stock deste dispositivo.");
      return;
    }
    setCart((current) => current
      .map((item) => item.productId === productId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  const cartLines = cart.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? { product, quantity: line.quantity } : null;
  }).filter((line): line is { product: Product; quantity: number } => line !== null);
  const cartTotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const receivedAmount = Number(amountReceived) || 0;
  const changeAmount = Math.max(0, receivedAmount - cartTotal);

  async function finishSale() {
    if (!profile || !data || cartLines.length === 0 || receivedAmount < cartTotal) return;
    if (!Number.isSafeInteger(receivedAmount)) {
      setToast("Introduza o valor recebido em Db inteiros.");
      return;
    }
    const updatedProducts = products.map((product) => {
      const line = cartLines.find((item) => item.product.id === product.id);
      return line ? { ...product, stock: Math.max(0, product.stock - line.quantity) } : product;
    });
    const sale: Sale = {
      id: createId(),
      createdAt: new Date().toISOString(),
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
      await saveSaleAndProducts(sale, updatedProducts, profile.id);
      setData({ ...data, products: updatedProducts, sales: [sale, ...sales] });
      setCart([]);
      setAmountReceived("");
      await refreshPending();
      setToast("Venda guardada localmente. Troco: " + money(changeAmount));
      if (online) void syncNow(profile);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Não foi possível guardar a venda.");
    }
  }

  const changeSection = (nextSection: Section) => {
    setHeaderPopover(null);
    if (profile?.role !== "admin" && nextSection === "relatorios") {
      setToast("Os relatórios financeiros estão disponíveis para o administrador.");
      return;
    }
    if (pathname !== sectionPaths[nextSection]) {
      // Keep route changes local so navigation and the active sale remain available offline.
      window.history.pushState(null, "", sectionPaths[nextSection]);
      window.scrollTo(0, 0);
    }
    setQuery("");
  };

  function followSectionLink(event: ReactMouseEvent<HTMLAnchorElement>, nextSection: Section) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    changeSection(nextSection);
  }

  const currentNav = navItems.find((item) => item.id === section) ?? navItems[0];
  const syncNeedsAttention = /falh|divergência|expirad|indisponível/i.test(syncMessage);
  const isSyncing = syncMessage === "A sincronizar…";

  function toggleHeaderPopover(nextPopover: Exclude<HeaderPopover, null>) {
    setHeaderPopover((current) => current === nextPopover ? null : nextPopover);
  }

  async function signOut() {
    if (!online) {
      setToast("Ligue-se à internet antes de terminar a sessão.");
      return;
    }
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      await clearOfflineProfile();
      profileRef.current = null;
      setProfile(null);
      setAuthMessage("Sessão terminada. Entre novamente para continuar.");
    } catch {
      setToast("Não foi possível terminar a sessão no servidor.");
    }
  }

  if (!authReady) {
    return <main className="auth-screen"><div className="auth-card auth-loading"><div className="brand-logo-frame auth-logo-frame"><Image src="/images/konta-logo.svg" alt="Kontá" width={1152} height={512} sizes="260px" loading="eager" /></div><strong>A preparar os dados da loja…</strong><span>O armazenamento local está a ser aberto.</span></div></main>;
  }
  if (!profile) return <AuthScreen online={online} initialMessage={authMessage} onSignedIn={acceptProfile} />;

  const visibleNav = navItems.filter((item) => profile.role === "admin" || item.id !== "relatorios");

  return (
    <div className={`app-frame ${sidebarCollapsed ? "app-frame--sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`} aria-label="Navegação principal">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-logo-frame">
              <Image src="/images/konta-logo.svg" alt="Kontá — Gestão simples. Negócios fortes." width={1152} height={512} sizes="180px" loading="eager" />
            </div>
            <div className="brand-mark" aria-hidden="true">
              <Image src="/images/konta-mark.svg" alt="" width={270} height={270} sizes="28px" />
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-controls="primary-navigation"
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <Icon className={`sidebar-toggle-icon ${sidebarCollapsed ? "is-collapsed" : ""}`} name="chevron" size={17} />
          </button>
        </div>
        <p className="nav-label">Comércio</p>
        <nav id="primary-navigation" className="nav-list">
          {visibleNav.map((item) => (
            <a key={item.id} href={sectionPaths[item.id]} className={`nav-button ${section === item.id ? "is-active" : ""}`} onClick={(event) => followSectionLink(event, item.id)} title={sidebarCollapsed ? item.label : undefined} aria-current={section === item.id ? "page" : undefined}>
              <span className="nav-icon"><Icon name={item.icon} size={21} /></span>
              <span className="nav-text">{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-promo"><p>Juntos<br />fazemos crescer!</p><span>Uma loja organizada abre espaço para novas ideias.</span></div>
      </aside>

      <div className="app-main">
        <header ref={topbarRef} className="topbar">
          <div className="topbar-left">
            <div className="brand-logo-frame mobile-brand-frame">
              <Image src="/images/konta-logo.svg" alt="Kontá" width={1152} height={512} sizes="72px" loading="eager" />
            </div>
            <div className="header-popover-anchor header-popover-anchor--store">
              <button className="store-select" type="button" aria-label={`Detalhes da loja: ${storeName}`} aria-haspopup="dialog" aria-expanded={headerPopover === "store"} aria-controls="store-header-popover" onClick={() => toggleHeaderPopover("store")}>
                <span className="store-icon"><Icon name="store" size={17} /></span>
                <span>{storeName}</span>
                <Icon className={`header-chevron ${headerPopover === "store" ? "is-open" : ""}`} name="chevron" size={15} />
              </button>
              <section id="store-header-popover" className="header-popover" role="dialog" aria-label="Detalhes da loja" hidden={headerPopover !== "store"}>
                <div className="header-popover-heading"><span className="store-icon"><Icon name="store" size={17} /></span><div><strong>{storeName}</strong><small>Loja activa</small></div></div>
                <dl className="store-facts"><div><dt>Módulo</dt><dd>Lojas e Comércio</dd></div><div><dt>Moeda</dt><dd>Db</dd></div></dl>
                <button className="header-popover-action" type="button" onClick={() => changeSection("definicoes")}>Ver definições da loja<Icon name="arrow-right" size={15} /></button>
              </section>
            </div>
          </div>
          <div className="topbar-right">
            <div className="header-popover-anchor header-popover-anchor--right">
              <button className={`connection ${online ? "" : "offline"}`} type="button" aria-label={`Estado da ligação e sincronização: ${online ? "online" : "offline"}`} aria-haspopup="dialog" aria-expanded={headerPopover === "connection"} aria-controls="connection-header-popover" onClick={() => toggleHeaderPopover("connection")}>
                <Icon name={online ? "wifi" : "wifi-off"} size={16} />
                {online ? "Online" : "Offline"}
              </button>
              <section id="connection-header-popover" className="header-popover" role="dialog" aria-labelledby="connection-popover-title" hidden={headerPopover !== "connection"}>
                <div className="header-popover-heading"><span className={`connection-dot ${online ? "is-online" : "is-offline"}`} /><div><strong id="connection-popover-title">{online ? "Ligação disponível" : "Sem ligação à internet"}</strong><small>{online ? "Estado da ligação" : "Modo offline"}</small></div></div>
                <div className="sync-details">
                  {pendingCount > 0 && <p>{pendingCount} registo{pendingCount === 1 ? "" : "s"} pendente{pendingCount === 1 ? "" : "s"} de sincronização.</p>}
                  {failedOperations.length > 0 && <p>{failedOperations.length} operação{failedOperations.length === 1 ? "" : "ões"} com falha na última tentativa.</p>}
                  {pendingCount === 0 && failedOperations.length === 0 && <p>{online ? syncMessage || (lastSyncAt ? "Tudo sincronizado." : "Ainda não há uma sincronização nesta sessão.") : "As novas operações ficam guardadas neste dispositivo."}</p>}
                  {!online && (pendingCount > 0 || failedOperations.length > 0) && <p>Os registos permanecem guardados localmente e serão enviados quando a ligação regressar.</p>}
                  {lastSyncAt && <small>Última sincronização: {new Date(lastSyncAt).toLocaleString("pt-PT")}</small>}
                </div>
                {online && (pendingCount > 0 || failedOperations.length > 0) && <button className="header-popover-action" type="button" disabled={isSyncing} onClick={() => { setHeaderPopover(null); void syncNow(profile, true); }}>{isSyncing ? "A sincronizar…" : "Tentar sincronizar agora"}<Icon name="arrow-right" size={15} /></button>}
              </section>
            </div>
            {pendingCount > 0 && <span className="status-pending"><span className="status-dot" />{pendingCount} pendente{pendingCount === 1 ? "" : "s"}</span>}
            <span className="top-divider" />
            <div className="header-popover-anchor header-popover-anchor--right">
              <button className="user-button" type="button" aria-label={`Conta de ${profile.name}`} aria-haspopup="dialog" aria-expanded={headerPopover === "profile"} aria-controls="profile-header-popover" onClick={() => toggleHeaderPopover("profile")}>
                <span className="avatar">{profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                <span className="user-copy"><strong>{profile.name}</strong><span>{profile.role === "admin" ? "Administrador" : "Colaborador"}</span></span>
                <Icon className={`header-chevron ${headerPopover === "profile" ? "is-open" : ""}`} name="chevron" size={15} />
              </button>
              <section id="profile-header-popover" className="header-popover" role="dialog" aria-label="Conta do utilizador" hidden={headerPopover !== "profile"}>
                <div className="header-popover-heading"><span className="avatar">{profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><strong>{profile.name}</strong><small>{profile.email}</small></div></div>
                <span className="profile-role">{profile.role === "admin" ? "Administrador" : "Colaborador"}</span>
                <div className="header-popover-actions"><button className="header-popover-action" type="button" onClick={() => changeSection("definicoes")}>Definições da conta<Icon name="arrow-right" size={15} /></button><button className="header-popover-action header-popover-action--signout" type="button" disabled={!online} onClick={() => { setHeaderPopover(null); void signOut(); }}>Terminar sessão</button></div>
                {!online && <small className="popover-help">Ligue-se à internet para terminar a sessão.</small>}
              </section>
            </div>
          </div>
        </header>

        <main className="page-content">
          {!online && <div className="offline-notice"><Icon name="wifi-off" size={17} /><span><strong>Modo offline.</strong> Os registos novos ficam guardados neste dispositivo até a sincronização com o servidor estar disponível.</span></div>}
          {syncMessage && online && <div className={`offline-notice ${syncNeedsAttention ? "error-notice" : ""}`}><Icon name={syncNeedsAttention ? "alert" : "check"} size={17} /><span>{syncMessage}{lastSyncAt && <small className="sync-time">Última sincronização: {new Date(lastSyncAt).toLocaleString("pt-PT")}</small>}</span></div>}
          {storageError && <div className="offline-notice error-notice"><Icon name="alert" size={17} /><span>{storageError}</span></div>}
          {data?.stockConflicts.length ? <div className="offline-notice error-notice"><Icon name="alert" size={17} /><span>{data.stockConflicts.length} divergência(s) de stock entre dispositivos. As vendas foram preservadas; o administrador deve reconciliar o saldo.</span></div> : null}
          {section === "inicio" && <DashboardView now={clientNow} userName={profile.name} canManageProducts={profile.role === "admin"} data={data} salesTotal={salesTotal} totalItems={totalItems} cashBalance={cashBalance} chartData={chartData} chartMax={chartMax} chartTotal={chartTotal} chartRange={chartRange} onRangeChange={setChartRange} activity={sortedActivity} onSectionChange={changeSection} onOpenModal={setModal} />}
          {section === "produtos" && <ProductsView products={products} canViewCosts={profile.role === "admin"} query={query} onQueryChange={setQuery} onAdd={profile.role === "admin" ? () => setModal("product") : undefined} />}
          {section === "vendas" && <SalesView products={products} cartLines={cartLines} cartTotal={cartTotal} receivedAmount={amountReceived} changeAmount={changeAmount} onAdd={addToCart} onChangeQuantity={changeQuantity} onReceivedChange={setAmountReceived} onFinish={finishSale} />}
          {section === "caixa" && <CashView sales={todaysSales} expenses={todaysExpenses} openingCash={OPENING_CASH} cashBalance={cashBalance} onAddExpense={() => setModal("expense")} />}
          {section === "relatorios" && profile.role === "admin" && <ReportsView sales={sales} expenses={expenses} products={products} chartData={chartData} chartMax={chartMax} chartTotal={chartTotal} chartRange={chartRange} onRangeChange={setChartRange} />}
          {section === "definicoes" && <SettingsView profile={profile} storeName={storeName} online={online} pendingCount={pendingCount} failedOperations={failedOperations} productCount={products.length} lastSyncAt={lastSyncAt} syncMessage={syncMessage} stockConflicts={data?.stockConflicts ?? []} onRetry={() => void syncNow(profile, true)} onRefresh={() => syncNow(profile)} onSignOut={signOut} />}
        </main>
      </div>

      {modal === "product" && profile.role === "admin" && <ProductModal onClose={() => setModal(null)} onSave={createProduct} />}
      {modal === "expense" && <ExpenseModal onClose={() => setModal(null)} onSave={createExpense} />}
      {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
    </div>
  );
}

type Activity = { id: string; createdAt: string; title: string; detail: string; amount: number; kind: "sale" | "expense" };

function PageHeading({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

function DashboardView({
  now, userName, canManageProducts, data, salesTotal, totalItems, cashBalance, chartData, chartMax, chartTotal, chartRange, onRangeChange, activity, onSectionChange, onOpenModal,
}: {
  now: Date | null; userName: string; canManageProducts: boolean; data: CommerceData | null; salesTotal: number; totalItems: number; cashBalance: number;
  chartData: Array<{ label: string; value: number }>; chartMax: number; chartTotal: number;
  chartRange: ChartRange; onRangeChange: (range: ChartRange) => void; activity: Activity[];
  onSectionChange: (section: Section) => void; onOpenModal: (modal: ModalKind) => void;
}) {
  const topProduct = data?.products.find((product) => product.id === "demo-mask") ?? data?.products[0];

  return (
    <>
      <section className="hero">
        <Image
          className="hero-image"
          src="/images/store-header.png"
          alt=""
          fill
          sizes="(max-width: 650px) 100vw, (max-width: 900px) calc(100vw - 72px), 100vw"
          preload
          aria-hidden="true"
        />
        <div className="hero-copy">
          <h1>{greeting(now)}, {userName.split(" ")[0]}!</h1>
          <p className="hero-subtitle">Aqui está o resumo da sua loja. Vamos fazer este dia render?</p>
          <div className="hero-rule" />
        </div>
        <span className="hero-date"><Icon name="calendar" size={14} />{now ? dayLabel(now, { weekday: "long", day: "numeric", month: "long" }) : "Hoje"}</span>
      </section>

      <dl className="store-overview" aria-label="Indicadores da loja">
        <div className="store-overview-primary">
          <dt>Vendas de hoje</dt>
          <dd className="store-overview-primary-value">{money(salesTotal)}</dd>
          <dd className="store-overview-primary-change"><Icon name="arrow-up" size={13} />12% face ao dia anterior</dd>
        </div>
        <div className="store-overview-stat">
          <span className="store-overview-icon" aria-hidden="true"><Icon name="box" size={20} /></span>
          <div><dt>Produtos em stock</dt><dd>{new Intl.NumberFormat("pt-PT").format(totalItems)}</dd><dd className="store-overview-note">{data?.products.length ?? 0} produtos no catálogo</dd></div>
        </div>
        <div className="store-overview-stat">
          <span className="store-overview-icon" aria-hidden="true"><Icon name="cash" size={20} /></span>
          <div><dt>Caixa atual</dt><dd>{money(cashBalance)}</dd><dd className="store-overview-note">Sessão de caixa em curso</dd></div>
        </div>
      </dl>

      <section className="dashboard-grid">
        <ChartPanel title="Desempenho" subtitle="Vendas registadas na loja" data={chartData} max={chartMax} total={chartTotal} range={chartRange} onRangeChange={onRangeChange} />
        <aside className="panel chart-summary">
          <span className="summary-icon"><Icon name="trend" size={20} /></span>
          <span className="summary-label">Total do período</span>
          <strong className="summary-value">{money(chartTotal)}</strong>
          <span className="summary-change">↑ 8% face ao período anterior</span>
          <div className="summary-separator" />
          <span className="summary-label">Produto em destaque</span>
          {topProduct ? <div className="favorite-product"><span className="product-emoji">{topProduct.emoji}</span><div><strong>{topProduct.name}</strong><span>{topProduct.stock} unidades em stock</span></div></div> : <p className="panel-subtitle">Adicione produtos para ver destaques.</p>}
          <div className="mini-progress"><span style={{ width: "72%" }} /></div>
        </aside>
      </section>

      <section className="below-grid">
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="receipt" size={18} /></span>Movimentos recentes</h2><button className="button button-ghost" type="button" onClick={() => onSectionChange("caixa")}>Ver caixa <Icon name="arrow-right" size={14} /></button></div>
          <div className="activity-list">
            {activity.length === 0 ? <div className="empty-row">Ainda não há movimentos registados.</div> : activity.slice(0, 4).map((item) => <ActivityRow key={item.id} item={item} />)}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="arrow-up" size={18} /></span>Ações rápidas</h2></div>
          <div className="quick-actions">
            <button className="quick-action" type="button" onClick={() => onSectionChange("vendas")}><span className="quick-action-icon"><Icon name="cart" size={18} /></span><span><strong>Nova venda</strong><span>Registar artigos e troco</span></span></button>
            {canManageProducts && <button className="quick-action" type="button" onClick={() => onOpenModal("product")}><span className="quick-action-icon"><Icon name="box" size={18} /></span><span><strong>Novo produto</strong><span>Atualizar o catálogo</span></span></button>}
            <button className="quick-action" type="button" onClick={() => onOpenModal("expense")}><span className="quick-action-icon"><Icon name="receipt" size={18} /></span><span><strong>Lançar despesa</strong><span>Registar saída de caixa</span></span></button>
            {canManageProducts && <button className="quick-action" type="button" onClick={() => onSectionChange("relatorios")}><span className="quick-action-icon"><Icon name="chart" size={18} /></span><span><strong>Ver relatórios</strong><span>Vendas, custos e margem</span></span></button>}
          </div>
        </div>
      </section>
    </>
  );
}

function ChartPanel({ title, subtitle, data, max, total, range, onRangeChange }: { title: string; subtitle: string; data: Array<{ label: string; value: number }>; max: number; total: number; range: ChartRange; onRangeChange: (range: ChartRange) => void }) {
  const options: Array<{ id: ChartRange; label: string }> = [{ id: "week", label: "Esta semana" }, { id: "month", label: "Este mês" }, { id: "year", label: "Este ano" }];
  return (
    <div className="panel">
      <div className="panel-header">
        <div><h2 className="panel-title"><span className="panel-title-icon"><Icon name="chart" size={18} /></span>{title}</h2><p className="panel-subtitle">{subtitle}</p></div>
        <div className="range-tabs" role="tablist" aria-label="Período do gráfico">{options.map((item) => <button key={item.id} type="button" role="tab" aria-selected={range === item.id} className={range === item.id ? "selected" : ""} onClick={() => onRangeChange(item.id)}>{item.label}</button>)}</div>
      </div>
      <div className="chart-area">
        <div className="bar-chart">
          <div className="chart-plot">
            <div className="chart-y-labels"><span>{money(max).replace(" Db", "")}</span><span>{money(Math.round(max * .66)).replace(" Db", "")}</span><span>{money(Math.round(max * .33)).replace(" Db", "")}</span><span>0</span></div>
            <div className="chart-gridlines"><span /><span /><span /><span /></div>
            <div className="bars">{data.map((point, index) => <div className="bar-column" key={`${point.label}-${index}`}><span className="bar-value">{point.value ? `${(point.value / 1000).toFixed(1)}k` : "–"}</span><span className="bar" style={{ height: `${Math.max(3, (point.value / max) * 78)}%` }} /><span className="bar-label">{point.label}</span></div>)}</div>
          </div>
        </div>
        <div className="chart-summary">
          <span className="summary-icon"><Icon name="trend" size={19} /></span>
          <span className="summary-label">Total do período</span>
          <strong className="summary-value">{money(total)}</strong>
          <span className="summary-change">{data.filter((point) => point.value > 0).length} períodos com vendas</span>
          <span className="summary-separator" />
          <span className="summary-label">Margem estimada</span>
          <strong className="summary-value">—</strong>
          <span className="summary-change">Detalhe disponível nos relatórios</span>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  return <div className={`activity-row ${item.kind === "expense" ? "expense" : ""}`}><span className="activity-icon"><Icon name={item.kind === "sale" ? "cart" : "receipt"} size={17} /></span><span className="activity-copy"><strong>{item.title}</strong><span>{item.detail} · {dayLabel(new Date(item.createdAt), { hour: "2-digit", minute: "2-digit" })}</span></span><strong className={`activity-amount ${item.kind === "expense" ? "negative" : ""}`}>{item.kind === "expense" ? "−" : "+"}{money(item.amount)}</strong></div>;
}

function ProductsView({ products, canViewCosts, query, onQueryChange, onAdd }: { products: Product[]; canViewCosts: boolean; query: string; onQueryChange: (value: string) => void; onAdd?: () => void }) {
  const visibleProducts = products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading title="Produtos" subtitle="Acompanhe o catálogo e os níveis de stock.">{onAdd && <button className="button button-primary" type="button" onClick={onAdd}><Icon name="plus" size={16} />Novo produto</button>}</PageHeading>
    <div className="toolbar"><label className="search-box"><Icon name="search" size={17} /><input aria-label="Pesquisar produtos por nome, código ou categoria" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Pesquisar por nome, código ou categoria" /></label><span className="demo-tag">{products.length} produtos</span></div>
    <div className="panel product-table"><div className="table-scroll"><table><thead><tr><th>Produto</th><th>Código</th><th>Preço</th>{canViewCosts && <th>Custo</th>}<th>Stock</th>{canViewCosts && <th>Margem</th>}</tr></thead><tbody>
      {visibleProducts.map((product) => <tr key={product.id}><td><span className="table-product"><span className="product-emoji">{product.emoji}</span><span><strong>{product.name}</strong><span>{product.category}</span></span></span></td><td>{product.sku}</td><td>{money(product.price)}</td>{canViewCosts && <td>{money(product.cost)}</td>}<td><span className={`stock-pill ${product.stock <= 0 ? "out" : product.stock < 10 ? "low" : ""}`}>{product.stock} un.</span></td>{canViewCosts && <td>{product.price > 0 ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : "—"}</td>}</tr>)}
      {visibleProducts.length === 0 && <tr><td className="empty-row" colSpan={canViewCosts ? 6 : 4}>Nenhum produto corresponde à pesquisa.</td></tr>}
    </tbody></table></div></div>
  </>;
}

function SalesView({ products, cartLines, cartTotal, receivedAmount, changeAmount, onAdd, onChangeQuantity, onReceivedChange, onFinish }: { products: Product[]; cartLines: Array<{ product: Product; quantity: number }>; cartTotal: number; receivedAmount: string; changeAmount: number; onAdd: (id: string) => void; onChangeQuantity: (id: string, delta: number) => void; onReceivedChange: (value: string) => void; onFinish: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || product.sku.toLowerCase().includes(query.toLowerCase()));
  const received = Number(receivedAmount) || 0;
  return <>
    <PageHeading title="Nova venda" subtitle="Selecione os produtos e confirme o pagamento em dinheiro."><span className="demo-tag">Venda em dinheiro · Db</span></PageHeading>
    <div className="toolbar"><label className="search-box"><Icon name="search" size={17} /><input aria-label="Pesquisar produtos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar produtos" /></label><span className="status-pending"><span className="status-dot" />Guardada neste dispositivo</span></div>
    <div className="sales-layout">
      <div className="panel"><div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="box" size={18} /></span>Catálogo</h2><span className="panel-subtitle">Toque num artigo para adicionar</span></div><div className="sales-products">{filtered.map((product) => <button className="sale-product" key={product.id} type="button" onClick={() => onAdd(product.id)} disabled={product.stock < 1}><span className="product-emoji">{product.emoji}</span><span className="sale-product-info"><strong>{product.name}</strong><span>{product.stock} em stock · {product.sku}</span></span><strong className="sale-product-price">{money(product.price)}</strong></button>)}</div></div>
      <aside className="panel cart-panel"><div className="cart-heading"><h2>Venda atual</h2><span>{cartLines.reduce((total, item) => total + item.quantity, 0)} artigos</span></div>
        {cartLines.length === 0 ? <div className="cart-empty"><span><Icon name="cart" size={23} /><br />Adicione produtos para começar.</span></div> : <div className="cart-items">{cartLines.map(({ product, quantity }) => <div className="cart-item" key={product.id}><span><strong>{product.name}</strong><span>{money(product.price)} cada</span></span><span className="qty-control"><button type="button" aria-label={`Remover uma unidade de ${product.name}`} onClick={() => onChangeQuantity(product.id, -1)}><Icon name="minus" size={12} /></button><b>{quantity}</b><button type="button" aria-label={`Adicionar uma unidade de ${product.name}`} onClick={() => onChangeQuantity(product.id, 1)}><Icon name="plus" size={12} /></button></span></div>)}</div>}
        <div className="cart-totals"><div className="total-row"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><div className="total-row grand"><span>Total</span><strong>{money(cartTotal)}</strong></div></div>
        <FormField className="cash-input" id="amount-received" label="Valor recebido"><MaskedNumberInput id="amount-received" minValue={0} value={receivedAmount} onValueChange={onReceivedChange} placeholder="0" /></FormField>
        <div className="change-line"><span>Troco</span><strong>{money(changeAmount)}</strong></div>
        <button className="button button-primary cart-submit" type="button" disabled={!cartLines.length || received < cartTotal} onClick={onFinish}><Icon name="check" size={16} />Confirmar venda</button>
      </aside>
    </div>
  </>;
}

function CashView({ sales, expenses, openingCash, cashBalance, onAddExpense }: { sales: Sale[]; expenses: Expense[]; openingCash: number; cashBalance: number; onAddExpense: () => void }) {
  const movements: Activity[] = [
    ...sales.map((sale) => ({ id: sale.id, createdAt: sale.createdAt, title: "Venda em dinheiro", detail: sale.syncState === "failed" ? "Falha de sincronização" : sale.syncState === "pending" ? "Pendente de sincronização" : "Registada", amount: sale.total, kind: "sale" as const })),
    ...expenses.map((expense) => ({ id: expense.id, createdAt: expense.createdAt, title: expense.description, detail: expense.syncState === "failed" ? "Falha de sincronização" : expense.syncState === "pending" ? "Pendente de sincronização" : expense.category, amount: expense.amount, kind: "expense" as const })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return <>
    <PageHeading title="Caixa" subtitle="Movimentos e saldo da sessão de hoje."><button className="button button-primary" type="button" onClick={onAddExpense}><Icon name="plus" size={16} />Lançar despesa</button></PageHeading>
    <div className="cash-summary"><div className="panel cash-stat"><span>Saldo inicial</span><strong>{money(openingCash)}</strong></div><div className="panel cash-stat"><span>Entradas de hoje</span><strong>{money(totalSales)}</strong></div><div className="panel cash-stat"><span>Caixa atual</span><strong>{money(cashBalance)}</strong></div></div>
    <div className="panel"><div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="receipt" size={18} /></span>Movimentos de hoje</h2><span className="status-pending"><span className="status-dot" />Sessão aberta</span></div><div className="activity-list">{movements.map((item) => <ActivityRow key={item.id} item={item} />)}{movements.length === 0 && <div className="empty-row">Ainda não há movimentos de caixa.</div>}</div><div className="panel-header"><span className="panel-subtitle">Despesas de hoje</span><strong>{money(totalExpenses)}</strong></div></div>
  </>;
}

function ReportsView({ sales, expenses, products, chartData, chartMax, chartTotal, chartRange, onRangeChange }: { sales: Sale[]; expenses: Expense[]; products: Product[]; chartData: Array<{ label: string; value: number }>; chartMax: number; chartTotal: number; chartRange: ChartRange; onRangeChange: (range: ChartRange) => void }) {
  const revenue = sales.reduce((total, sale) => total + sale.total, 0);
  const costs = sales.reduce((total, sale) => total + sale.items.reduce((subtotal, line) => subtotal + line.unitCost * line.quantity, 0), 0) + expenses.reduce((total, expense) => total + expense.amount, 0);
  const grossProfit = revenue - costs;
  const margin = revenue > 0 ? Math.max(0, Math.round((grossProfit / revenue) * 100)) : 0;
  const soldUnits = sales.reduce((total, sale) => total + sale.items.reduce((subtotal, line) => subtotal + line.quantity, 0), 0);
  return <>
    <PageHeading title="Relatórios" subtitle="Acompanhe vendas, custos e margem da loja."><button className="button button-ghost" type="button"><Icon name="download" size={15} />Exportar</button></PageHeading>
    <div className="cash-summary"><div className="panel cash-stat"><span>Vendas no período</span><strong>{money(chartTotal)}</strong></div><div className="panel cash-stat"><span>Custos registados</span><strong>{money(costs)}</strong></div><div className="panel cash-stat"><span>Margem estimada</span><strong>{margin}%</strong></div></div>
    <div className="report-grid"><ChartPanel title="Vendas por período" subtitle="Valores guardados neste dispositivo" data={chartData} max={chartMax} total={chartTotal} range={chartRange} onRangeChange={onRangeChange} /><div className="panel"><div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="box" size={18} /></span>Produtos em destaque</h2></div><div className="report-products">{products.slice(0, 5).map((product) => { const units = sales.flatMap((sale) => sale.items).filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0); return <div className="report-product-row" key={product.id}><span className="product-emoji">{product.emoji}</span><span><strong>{product.name}</strong><small>{units || 0} unidades vendidas</small></span><b>{money(product.price - product.cost)} / un.</b></div>; })}</div></div></div>
    <p className="panel-subtitle" style={{ margin: "15px 4px" }}>{soldUnits} unidades vendidas no histórico local. Despesas: {money(expenses.reduce((sum, expense) => sum + expense.amount, 0))}.</p>
  </>;
}

type TeamMember = { id: string; name: string; email: string; role: "admin" | "collaborator"; createdAt: string };

function SettingsView({ profile, storeName, online, pendingCount, failedOperations, productCount, lastSyncAt, syncMessage, stockConflicts, onRetry, onRefresh, onSignOut }: {
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
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamMessage, setTeamMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loadMembers = useCallback(async () => {
    if (profile.role !== "admin" || !online) return;
    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json() as { members: TeamMember[] };
      setMembers(result.members);
    } catch {
      setTeamMessage("Não foi possível carregar a lista de colaboradores.");
    }
  }, [online, profile.role]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function createCollaborator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setTeamMessage("");
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Não foi possível criar o acesso.");
      }
      setName("");
      setEmail("");
      setPassword("");
      setTeamMessage("Acesso de colaborador criado.");
      await loadMembers();
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "Não foi possível criar o acesso.");
    } finally {
      setCreating(false);
    }
  }

  return <>
    <PageHeading title="Definições" subtitle="Conta, acessos e estado de sincronização." />
    <div className="settings-grid">
      <section className="panel settings-panel"><h2>Loja</h2><p>Os dados fiscais e o país serão definidos antes de ativar documentos oficiais.</p><div className="setting-line"><span>Nome</span><strong>{storeName}</strong></div><div className="setting-line"><span>Moeda de apresentação</span><strong>Db</strong></div><div className="setting-line"><span>País</span><strong>Por definir</strong></div><div className="setting-line"><span>Módulo ativo</span><strong>Lojas e Comércio</strong></div><div className="setting-line"><span>Utilizador</span><strong>{profile.name} · {profile.role === "admin" ? "Administrador" : "Colaborador"}</strong></div><button className="button button-ghost settings-signout" type="button" onClick={onSignOut} disabled={!online}>Terminar sessão</button></section>
      <section className="panel settings-panel"><h2>Ligação e dados</h2><p>Os registos offline ficam guardados neste dispositivo e são enviados com a aplicação aberta quando a internet regressar.</p><div className="setting-line"><span>Estado de rede</span><strong>{online ? "Online" : "Offline"}</strong></div><div className="setting-line"><span>Produtos neste dispositivo</span><strong>{productCount}</strong></div><div className="setting-line"><span>Operações na fila local</span><strong>{pendingCount}</strong></div><div className="setting-line"><span>Última sincronização</span><strong>{lastSyncAt ? new Date(lastSyncAt).toLocaleString("pt-PT") : "Ainda não sincronizado"}</strong></div><div className="setting-line"><span>Estado</span><strong>{syncMessage || (online ? "Pronto" : "A aguardar ligação")}</strong></div>{pendingCount > 0 && <button className="button button-primary settings-retry" type="button" onClick={onRetry} disabled={!online}>Tentar sincronizar novamente</button>}{failedOperations.length > 0 && <div className="failed-operations"><strong>Operações com falha</strong>{failedOperations.map((operation) => <div key={operation.id}><span>{operation.type === "sale.create" ? "Venda" : operation.type === "expense.create" ? "Despesa" : "Produto"} · {operation.payload.id.slice(0, 8)}</span><small>{operation.lastError ?? "Verifique os dados e tente novamente."}</small></div>)}</div>}</section>
    </div>
    {profile.role === "admin" && <section className="panel team-panel">
      <div className="panel-header"><div><h2 className="panel-title"><span className="panel-title-icon"><Icon name="user" size={18} /></span>Acessos de colaboradores</h2><p className="panel-subtitle">Colaboradores podem registar vendas e despesas. Produtos e relatórios financeiros ficam reservados ao administrador.</p></div></div>
      <form className="team-form" onSubmit={createCollaborator}>
        <FormField id="team-name" label="Nome"><input id="team-name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></FormField>
        <FormField id="team-email" label="E-mail"><input id="team-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField id="team-password" label="Palavra-passe inicial"><input id="team-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
        <button className="button button-primary" type="submit" disabled={!online || creating}>{creating ? "A criar…" : "Criar acesso"}</button>
      </form>
      {teamMessage && <p className="team-message" role="status">{teamMessage}</p>}
      <div className="team-list">{members.map((member) => <div className="team-row" key={member.id}><span className="avatar">{member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.email}</small></span><span className="team-role">{member.role === "admin" ? "Administrador" : "Colaborador"}</span></div>)}{members.length === 0 && <p className="panel-subtitle">{online ? "Ainda não há acessos listados." : "Ligue-se para gerir os acessos da equipa."}</p>}</div>
    </section>}
    {stockConflicts.length > 0 && <section className="panel team-panel"><div className="panel-header"><div><h2 className="panel-title">Divergências de stock</h2><p className="panel-subtitle">As vendas offline foram guardadas, embora o stock disponível tenha sido excedido. O administrador reconcilia o saldo após a contagem física.</p></div></div><div className="team-list">{stockConflicts.map((conflict) => <StockConflictRow key={conflict.id} conflict={conflict} canResolve={profile.role === "admin"} online={online} onResolved={onRefresh} />)}</div></section>}
  </>;
}

function StockConflictRow({ conflict, canResolve, online, onResolved }: { conflict: CommerceData["stockConflicts"][number]; canResolve: boolean; online: boolean; onResolved: () => void | Promise<void> }) {
  const [countedStock, setCountedStock] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(countedStock);
    if (!Number.isSafeInteger(count) || count < 0) {
      setMessage("Introduza uma contagem inteira igual ou superior a zero.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/commerce/stock-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflictId: conflict.id, countedStock: count }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Não foi possível reconciliar o stock.");
      }
      setMessage("Saldo reconciliado e ajuste registado.");
      await onResolved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reconciliar o stock.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="stock-conflict-row">
    <div><strong>{conflict.productName}</strong><small>Venda {conflict.saleId.slice(0, 8)} · dispositivo {conflict.deviceId.slice(0, 8)} · saldo após venda: {conflict.stockAfter}</small></div>
    {canResolve ? <form onSubmit={submit}><FormField id={`stock-count-${conflict.id}`} label="Contagem física"><MaskedNumberInput id={`stock-count-${conflict.id}`} minValue={0} required value={countedStock} onValueChange={setCountedStock} /></FormField><button className="button button-primary" type="submit" disabled={!online || saving}>{saving ? "A guardar…" : "Reconciliar"}</button></form> : <span className="team-role">Apenas administrador</span>}
    {message && <small className="stock-conflict-message" role="status">{message}</small>}
  </div>;
}

function ProductModal({ onClose, onSave }: { onClose: () => void; onSave: (product: Omit<Product, "id">) => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Geral");
  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [emoji, setEmoji] = useState("📦");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name: name.trim(), sku: sku.trim() || `PRD-${Date.now().toString().slice(-5)}`, category, stock: Math.max(0, Number(stock) || 0), price: Math.max(0, Math.round(Number(price) || 0)), cost: Math.max(0, Math.round(Number(cost) || 0)), emoji });
  }
  return <Modal title="Novo produto" subtitle="Adicione um artigo ao catálogo da loja." onClose={onClose}>
    <form onSubmit={submit}><div className="form-grid">
      <FormField id="product-name" label="Nome do produto" className="full"><input id="product-name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Cesto de palha" /></FormField>
      <FormField id="product-sku" label="Código"><input id="product-sku" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Gerado se vazio" /></FormField>
      <FormField id="product-category" label="Categoria"><input id="product-category" required value={category} onChange={(event) => setCategory(event.target.value)} /></FormField>
      <FormField id="product-price" label="Preço de venda (Db)"><MaskedNumberInput id="product-price" required minValue={1} value={price} onValueChange={setPrice} /></FormField>
      <FormField id="product-cost" label="Custo (Db)"><MaskedNumberInput id="product-cost" required minValue={0} value={cost} onValueChange={setCost} /></FormField>
      <FormField id="product-stock" label="Stock inicial"><MaskedNumberInput id="product-stock" minValue={0} value={stock} onValueChange={setStock} /></FormField>
      <FormField id="product-emoji" label="Símbolo"><CustomSelect id="product-emoji" value={emoji} onChange={setEmoji} variant="symbol" options={productSymbolOptions} /></FormField>
    </div><div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Guardar produto</button></div></form>
  </Modal>;
}

function ExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (expense: Omit<Expense, "id" | "createdAt" | "syncState">) => void }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Operação");
  const [amount, setAmount] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ description: description.trim(), category, amount: Math.round(Number(amount) || 0) });
  }
  return <Modal title="Lançar despesa" subtitle="O valor será registado no caixa local." onClose={onClose}>
    <form onSubmit={submit}><div className="form-grid">
      <FormField id="expense-description" label="Descrição" className="full"><input id="expense-description" required autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Transporte de mercadoria" /></FormField>
      <FormField id="expense-category" label="Categoria"><CustomSelect id="expense-category" value={category} onChange={setCategory} options={expenseCategoryOptions} /></FormField>
      <FormField id="expense-amount" label="Valor (Db)"><MaskedNumberInput id="expense-amount" required minValue={1} value={amount} onValueChange={setAmount} /></FormField>
    </div><div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Guardar despesa</button></div></form>
  </Modal>;
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="modal-close" type="button" aria-label="Fechar" onClick={onClose}><Icon name="close" size={16} /></button></div>{children}</section></div>;
}
