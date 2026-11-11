export function money(value: number) {
  const formatted = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0, useGrouping: "always" }).format(value);
  return `${formatted.replaceAll("\u00a0", ".")} Db`;
}

/** Valores a partir de 10 mil aparecem em milhares (ex.: 71.3k Db), como no resumo do painel. */
export function compactMoney(value: number) {
  if (Math.abs(value) < 10_000) return money(value);
  return `${(value / 1000).toFixed(1)}k Db`;
}

/** Variação percentual face a um valor anterior; `null` quando não há base de comparação. */
export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function dayLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-PT", options).format(date);
}

export function greeting(date: Date | null) {
  const hour = date?.getHours() ?? 9;
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function todayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

