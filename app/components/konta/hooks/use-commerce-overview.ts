import { useMemo } from "react";
import type { CashSession, CommerceData } from "../../../lib/model";
import { bucketize, previousPeriodTotal, topProductInPeriod } from "../chart-data";
import { todayKey } from "../format";
import type { Activity, ChartRange } from "../types";

const EMPTY_PRODUCTS: CommerceData["products"] = [];
const EMPTY_SALES: CommerceData["sales"] = [];
const EMPTY_EXPENSES: CommerceData["expenses"] = [];

export function useCommerceOverview(data: CommerceData | null, deviceId: string, now: Date | null, chartRange: ChartRange, chartProductId = "all") {
  const products = data?.products ?? EMPTY_PRODUCTS;
  const sales = data?.sales ?? EMPTY_SALES;
  const expenses = data?.expenses ?? EMPTY_EXPENSES;
  const cashSessions = useMemo(() => (data?.cashSessions ?? [])
    .filter((session) => session.deviceId === deviceId)
    .sort((left, right) => right.openedAt.localeCompare(left.openedAt)), [data?.cashSessions, deviceId]);
  const activeCashSession = cashSessions.find((session) => session.status === "open") ?? null;
  const activeSessionSales = activeCashSession ? sales.filter((sale) => sale.cashSessionId === activeCashSession.id) : [];
  const activeSessionExpenses = activeCashSession ? expenses.filter((expense) => expense.cashSessionId === activeCashSession.id) : [];
  const today = now ? todayKey(now) : "";
  const todaysSales = useMemo(() => sales.filter((sale) => todayKey(new Date(sale.createdAt)) === today), [sales, today]);
  const salesTotal = todaysSales.reduce((total, sale) => total + sale.total, 0);
  const yesterday = now ? todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) : "";
  const yesterdaySalesTotal = useMemo(() => sales
    .filter((sale) => todayKey(new Date(sale.createdAt)) === yesterday)
    .reduce((total, sale) => total + sale.total, 0), [sales, yesterday]);
  const cashBalance = activeCashSession
    ? activeCashSession.openingAmount
      + activeSessionSales.reduce((total, sale) => total + sale.total, 0)
      - activeSessionExpenses.reduce((total, expense) => total + expense.amount, 0)
    : 0;
  const productFilter = chartProductId === "all" ? undefined : chartProductId;
  const chartData = useMemo(() => now ? bucketize(sales, chartRange, now, productFilter) : [], [sales, chartRange, now, productFilter]);
  const previousChartTotal = useMemo(() => now ? previousPeriodTotal(sales, chartRange, now, productFilter) : 0, [sales, chartRange, now, productFilter]);
  const topProduct = useMemo(() => now ? topProductInPeriod(sales, products, chartRange, now) : null, [sales, products, chartRange, now]);
  const chartMax = Math.max(1, ...chartData.map((point) => point.value));
  const chartTotal = chartData.reduce((total, point) => total + point.value, 0);
  const totalItems = products.reduce((total, product) => total + product.stock, 0);
  const sortedActivity = useMemo<Activity[]>(() => [
    ...sales.map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt,
      title: "Venda registada",
      detail: `${sale.items.length || 1} artigo${sale.items.length === 1 ? "" : "s"} · ${sale.syncState === "failed" ? "Falha" : sale.syncState === "pending" ? "Pendente" : "Sincronizada"}`,
      amount: sale.total,
      kind: "sale" as const,
    })),
    ...expenses.map((expense) => ({
      id: expense.id,
      createdAt: expense.createdAt,
      title: expense.description,
      detail: `${expense.category} · ${expense.syncState === "failed" ? "Falha" : expense.syncState === "pending" ? "Pendente" : "Sincronizada"}`,
      amount: expense.amount,
      kind: "expense" as const,
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5), [sales, expenses]);

  return {
    products,
    sales,
    expenses,
    cashSessions: cashSessions as CashSession[],
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
  };
}
