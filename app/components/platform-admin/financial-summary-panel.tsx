import { money } from "../konta/format";
import type { FinancialSummary } from "./types";

export function FinancialSummaryPanel({ storeName, summary }: { storeName: string; summary: FinancialSummary }) {
  return <section className="platform-financial-panel" aria-label={`Resumo financeiro de ${storeName}`}>
    <div className="platform-financial-heading"><div><span className="platform-eyebrow">Acesso auditado · histórico total</span><h2>Resumo financeiro · {storeName}</h2></div><span className="platform-access-pill">Expira às {new Date(summary.expiresAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div className="platform-financial-grid">
      <div><span>Vendas</span><strong>{money(summary.sales)}</strong><small>{summary.salesCount} registos</small></div>
      <div><span>Custos dos produtos</span><strong>{money(summary.costs)}</strong><small>Baseado no custo registado em cada venda</small></div>
      <div><span>Despesas</span><strong>{money(summary.expenses)}</strong><small>Despesas registadas na loja</small></div>
      <div className={summary.profit < 0 ? "is-negative" : "is-positive"}><span>Resultado estimado</span><strong>{money(summary.profit)}</strong><small>Vendas − custos − despesas</small></div>
    </div>
    <p className="platform-financial-note">Motivo: {summary.accessReason}. A margem estimada é {summary.margin === null ? "indisponível sem vendas" : `${summary.margin.toFixed(1).replace(".", ",")}%`}.</p>
  </section>;
}
