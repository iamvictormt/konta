import type { Product, Sale } from "../../lib/model";
import type { ChartRange } from "./types";
import { dayLabel } from "./format";

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

type Bucket = { label: string; start: Date; end: Date };

function buildBuckets(range: ChartRange, now: Date): Bucket[] {
  const buckets: Bucket[] = [];

  if (range === "week") {
    for (let index = 6; index >= 0; index -= 1) {
      const day = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - index));
      const end = new Date(day.getTime() + 86_400_000);
      const weekday = dayLabel(day, { weekday: "short" }).replace(".", "");
      buckets.push({ label: weekday.charAt(0).toUpperCase() + weekday.slice(1, 3), start: day, end });
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

  return buckets;
}

function inWindow(sale: Sale, start: number, end: number) {
  const timestamp = new Date(sale.createdAt).getTime();
  return timestamp >= start && timestamp < end;
}

/** Valor de uma venda, restrito às linhas de um produto quando há filtro. */
export function saleValue(sale: Sale, productId?: string) {
  if (!productId) return sale.total;
  return sale.items
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity * line.unitPrice, 0);
}

export function bucketize(sales: Sale[], range: ChartRange, now: Date, productId?: string) {
  return buildBuckets(range, now).map((bucket) => {
    const value = sales
      .filter((sale) => inWindow(sale, bucket.start.getTime(), bucket.end.getTime()))
      .reduce((total, sale) => total + saleValue(sale, productId), 0);
    return { label: bucket.label, value };
  });
}

/** Janela coberta pelo gráfico e janela anterior com a mesma duração. */
function periodWindows(range: ChartRange, now: Date) {
  const buckets = buildBuckets(range, now);
  const start = buckets[0].start.getTime();
  const end = buckets[buckets.length - 1].end.getTime();
  return { start, end, previousStart: start - (end - start) };
}

export function previousPeriodTotal(sales: Sale[], range: ChartRange, now: Date, productId?: string) {
  const { start, previousStart } = periodWindows(range, now);
  return sales
    .filter((sale) => inWindow(sale, previousStart, start))
    .reduce((total, sale) => total + saleValue(sale, productId), 0);
}

/** Produto com mais unidades vendidas na janela do gráfico. */
export function topProductInPeriod(sales: Sale[], products: Product[], range: ChartRange, now: Date) {
  const { start, end } = periodWindows(range, now);
  const units = new Map<string, number>();
  for (const sale of sales) {
    if (!inWindow(sale, start, end)) continue;
    for (const line of sale.items) units.set(line.productId, (units.get(line.productId) ?? 0) + line.quantity);
  }

  let best: { product: Product; units: number } | null = null;
  for (const product of products) {
    const sold = units.get(product.id) ?? 0;
    if (sold > 0 && (!best || sold > best.units)) best = { product, units: sold };
  }
  return best;
}
