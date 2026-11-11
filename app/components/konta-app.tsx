"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthScreen } from "./konta/auth/auth-screen";
import { LoadingScreen } from "./konta/auth/loading-screen";
import { ModuleAccessScreen } from "./konta/auth/module-access-screen";
import { CashView } from "./konta/cash/cash-view";
import { DashboardView } from "./konta/dashboard/dashboard-view";
import { ExpenseModal } from "./konta/expenses/expense-modal";
import { AppShell } from "./konta/layout/app-shell";
import { pathSections, sectionPaths } from "./konta/navigation";
import { ProductModal } from "./konta/products/product-modal";
import { ProductsView } from "./konta/products/products-view";
import { ReportsView } from "./konta/reports/reports-view";
import { SalesView } from "./konta/sales/sales-view";
import { SettingsView } from "./konta/settings/settings-view";
import { ToastNotice } from "./konta/shared/toast-notice";
import { useCommerceActions } from "./konta/hooks/use-commerce-actions";
import { useCommerceOverview } from "./konta/hooks/use-commerce-overview";
import { useCommerceSession } from "./konta/hooks/use-commerce-session";
import { useSaleCart } from "./konta/hooks/use-sale-cart";
import type { ModalKind, Section, ChartRange } from "./konta/types";
import { moduleForPath, STORE_MODULE_ROUTES, type StoreModuleId } from "../lib/store-modules";

export default function KontaApp() {
  const pathname = usePathname();
  const section = pathSections[pathname] ?? "inicio";
  const currentModule = moduleForPath(pathname);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("week");
  const [chartProduct, setChartProduct] = useState("all");
  const session = useCommerceSession(setToast);
  const {
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
    refreshPending,
    syncNow,
    acceptProfile,
    updateStoreDetails,
    signOut,
  } = session;
  const visibleSection = profile?.role === "admin" || section !== "relatorios" ? section : "inicio";
  const overview = useCommerceOverview(data, deviceId, clientNow, chartRange, visibleSection === "inicio" ? chartProduct : "all");
  const {
    products,
    sales,
    expenses,
    cashSessions,
    activeCashSession,
    salesTotal,
    yesterdaySalesTotal,
    cashBalance,
    chartData,
    chartMax,
    chartTotal,
    previousChartTotal,
    topProduct,
    totalItems,
    sortedActivity,
  } = overview;
  const saleCart = useSaleCart(products, setToast);
  const commerceActions = useCommerceActions({
    data,
    setData,
    profile,
    deviceId,
    online,
    activeCashSession,
    cashBalance,
    cartCount: saleCart.cart.length,
    cartLines: saleCart.cartLines,
    cartTotal: saleCart.cartTotal,
    receivedAmount: saleCart.receivedAmountValue,
    changeAmount: saleCart.changeAmount,
    refreshPending,
    syncNow,
    clearCart: saleCart.clearCart,
    closeModal: () => setModal(null),
    notify: setToast,
  });

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

  function openExpenseModal() {
    if (!activeCashSession) {
      changeSection("caixa");
      setToast("Abra uma sessão de caixa antes de lançar despesas.");
      return;
    }
    setModal("expense");
  }

  function openDashboardModal(kind: ModalKind) {
    if (kind === "expense") openExpenseModal();
    else setModal(kind);
  }

  if (!authReady) return <LoadingScreen />;
  if (!profile) {
    return <AuthScreen
      online={online}
      initialMessage={authMessage}
      onSignedIn={(nextProfile, nextStoreName) => { void acceptProfile(nextProfile, nextStoreName); }}
    />;
  }

  if (currentModule !== "commerce" || !profile.enabledModules.includes("commerce")) {
    return <ModuleAccessScreen
      profile={profile}
      storeName={storeName}
      online={online}
      message={syncMessage}
      currentModule={currentModule}
      onModuleNavigate={changeModule}
      onSignOut={() => { void signOut(); }}
    />;
  }

  return <>
    <AppShell
      section={visibleSection}
      profile={profile}
      storeName={storeName}
      online={online}
      pendingCount={pendingCount}
      lastSyncAt={lastSyncAt}
      syncMessage={syncMessage}
      storageError={storageError}
      stockConflictCount={data?.stockConflicts.length ?? 0}
      onNavigate={changeSection}
      onModuleNavigate={changeModule}
    >
      {visibleSection === "inicio" && <DashboardView
        now={clientNow}
        userName={profile.name}
        canManageProducts={profile.role === "admin"}
        products={products}
        salesTotal={salesTotal}
        yesterdaySalesTotal={yesterdaySalesTotal}
        totalItems={totalItems}
        cashBalance={cashBalance}
        cashSessionOpen={!!activeCashSession}
        chartData={chartData}
        chartMax={chartMax}
        chartTotal={chartTotal}
        previousChartTotal={previousChartTotal}
        topProduct={topProduct}
        chartRange={chartRange}
        onRangeChange={setChartRange}
        chartProduct={chartProduct}
        onProductChange={setChartProduct}
        activity={sortedActivity}
        onSectionChange={changeSection}
        onOpenModal={openDashboardModal}
      />}
      {visibleSection === "produtos" && <ProductsView
        products={products}
        canViewCosts={profile.role === "admin"}
        onAdd={profile.role === "admin" ? () => setModal("product") : undefined}
      />}
      {visibleSection === "vendas" && <SalesView
        products={products}
        cartLines={saleCart.cartLines}
        cartTotal={saleCart.cartTotal}
        receivedAmount={saleCart.amountReceived}
        changeAmount={saleCart.changeAmount}
        sessionOpen={!!activeCashSession}
        onOpenCash={() => changeSection("caixa")}
        onAdd={saleCart.addToCart}
        onChangeQuantity={saleCart.changeQuantity}
        onReceivedChange={saleCart.setAmountReceived}
        onFinish={commerceActions.finishSale}
      />}
      {visibleSection === "caixa" && <CashView
        key={activeCashSession?.id ?? "no-active-session"}
        sessions={cashSessions}
        sales={sales}
        expenses={expenses}
        cashBalance={cashBalance}
        onOpenSession={commerceActions.openCashSession}
        onCloseSession={commerceActions.closeCashSession}
        onAddExpense={openExpenseModal}
      />}
      {visibleSection === "relatorios" && profile.role === "admin" && <ReportsView
        sales={sales}
        expenses={expenses}
        products={products}
        chartData={chartData}
        chartMax={chartMax}
        chartTotal={chartTotal}
        chartRange={chartRange}
        onRangeChange={setChartRange}
      />}
      {visibleSection === "loja" && <SettingsView
        profile={profile}
        storeName={storeName}
        online={online}
        pendingCount={pendingCount}
        failedOperations={failedOperations}
        productCount={products.length}
        lastSyncAt={lastSyncAt}
        syncMessage={syncMessage}
        stockConflicts={data?.stockConflicts ?? []}
        onRetry={() => { void syncNow(profile, true); }}
        onRefresh={() => syncNow(profile)}
        onSignOut={() => { void signOut(); }}
        onSaveDetails={updateStoreDetails}
      />}
    </AppShell>
    {modal === "product" && profile.role === "admin" && <ProductModal onClose={() => setModal(null)} onSave={commerceActions.createProduct} />}
    {modal === "expense" && <ExpenseModal onClose={() => setModal(null)} onSave={commerceActions.createExpense} />}
    <ToastNotice message={toast} />
  </>;
}
