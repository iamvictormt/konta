import { useState } from "react";
import type { CommerceProfile } from "@/app/lib/model";
import type { StoreModuleId } from "@/app/lib/store-modules";
import type { useCommerceSession } from "./hooks/use-commerce-session";
import type { ChartRange, Section } from "./types";
import { CashView } from "./cash/cash-view";
import { DashboardView } from "./dashboard/dashboard-view";
import { ExpenseModal } from "./expenses/expense-modal";
import { AppShell } from "./layout/app-shell";
import { ProductModal } from "./products/product-modal";
import { ProductsView } from "./products/products-view";
import { ReportsView } from "./reports/reports-view";
import { SalesView } from "./sales/sales-view";
import { SettingsView } from "./settings/settings-view";
import { useCommerceActions } from "./hooks/use-commerce-actions";
import { useCommerceOverview } from "./hooks/use-commerce-overview";
import { useSaleCart } from "./hooks/use-sale-cart";

type CommerceModal =
  | { kind: "new-product" }
  | { kind: "edit-product"; productId: string }
  | { kind: "expense" };

type CommerceWorkspaceProps = {
  active: boolean;
  section: Section;
  profile: CommerceProfile;
  session: ReturnType<typeof useCommerceSession>;
  onNavigate: (section: Section) => void;
  onModuleNavigate: (moduleId: StoreModuleId) => void;
  notify: (message: string) => void;
};

export function CommerceWorkspace({ active, section, profile, session, onNavigate, onModuleNavigate, notify }: CommerceWorkspaceProps) {
  const [modal, setModal] = useState<CommerceModal | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("week");
  const [chartProduct, setChartProduct] = useState("all");
  const {
    data, setData, deviceId, storeName, clientNow, online, pendingCount,
    failedOperations, lastSyncAt, syncMessage, storageError, refreshPending,
    syncNow, updateStoreSettings, signOut,
  } = session;

  function closeModal() {
    setModal(null);
  }

  function openNewProduct() {
    setModal({ kind: "new-product" });
  }

  const visibleSection = profile.role === "admin" || section !== "relatorios" ? section : "inicio";
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
  const sellableProducts = products.filter((product) => product.active !== false);
  const saleCart = useSaleCart(sellableProducts, notify);
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
    closeModal,
    notify,
  });

  function openExpenseModal() {
    if (!activeCashSession) {
      onNavigate("caixa");
      notify("Abra uma sessão de caixa antes de lançar despesas.");
      return;
    }
    setModal({ kind: "expense" });
  }

  if (!active) return null;

  const editingProductId = modal?.kind === "edit-product" ? modal.productId : undefined;

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
      onNavigate={onNavigate}
      onModuleNavigate={onModuleNavigate}
      onSignOut={signOut}
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
        onSectionChange={onNavigate}
        onAddProduct={openNewProduct}
        onAddExpense={openExpenseModal}
      />}
      {visibleSection === "produtos" && <ProductsView
        products={products}
        canViewCosts={profile.role === "admin"}
        onAdd={profile.role === "admin" ? openNewProduct : undefined}
        onEdit={profile.role === "admin" ? (productId) => setModal({ kind: "edit-product", productId }) : undefined}
      />}
      {visibleSection === "vendas" && <SalesView
        products={sellableProducts}
        cartLines={saleCart.cartLines}
        cartTotal={saleCart.cartTotal}
        receivedAmount={saleCart.amountReceived}
        changeAmount={saleCart.changeAmount}
        sessionOpen={!!activeCashSession}
        onOpenCash={() => onNavigate("caixa")}
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
        onSaveDetails={(storeName, ownerName) => updateStoreSettings({ storeName, ownerName })}
        onSaveEmail={(email) => updateStoreSettings({ email })}
      />}
    </AppShell>
    {modal && modal.kind !== "expense" && profile.role === "admin" && (
      <ProductModal
        key={editingProductId ?? "new"}
        product={products.find((product) => product.id === editingProductId)}
        onClose={closeModal}
        onSave={(product, photo) => commerceActions.saveCatalogProduct(product, photo, editingProductId)}
      />
    )}
    {modal?.kind === "expense" && <ExpenseModal onClose={closeModal} onSave={commerceActions.createExpense} />}
  </>;
}
