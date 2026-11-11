import { ProductThumbnail } from "../products/product-thumbnail";
import Icon from "../../ui-icon";
import type { Expense, Product, Sale } from "../../../lib/model";
import { money } from "../format";
import type { ChartRange } from "../types";
import { ChartPanel } from "../shared/chart-panel";
import { PageHeading } from "../shared/page-heading";

export function ReportsView({ sales, expenses, products, chartData, chartMax, chartTotal, chartRange, onRangeChange }: { sales: Sale[]; expenses: Expense[]; products: Product[]; chartData: Array<{ label: string; value: number }>; chartMax: number; chartTotal: number; chartRange: ChartRange; onRangeChange: (range: ChartRange) => void }) {
  const revenue = sales.reduce((total, sale) => total + sale.total, 0);
  const costs = sales.reduce((total, sale) => total + sale.items.reduce((subtotal, line) => subtotal + line.unitCost * line.quantity, 0), 0) + expenses.reduce((total, expense) => total + expense.amount, 0);
  const grossProfit = revenue - costs;
  const margin = revenue > 0 ? Math.max(0, Math.round((grossProfit / revenue) * 100)) : 0;
  const soldUnits = sales.reduce((total, sale) => total + sale.items.reduce((subtotal, line) => subtotal + line.quantity, 0), 0);
  return <>
    <PageHeading title="Relatórios" subtitle="Acompanhe vendas, custos e margem da loja."><button className="button button-ghost" type="button"><Icon name="download" size={15} />Exportar</button></PageHeading>
    <div className="cash-summary"><div className="panel cash-stat"><span>Vendas no período</span><strong>{money(chartTotal)}</strong></div><div className="panel cash-stat"><span>Custos registados</span><strong>{money(costs)}</strong></div><div className="panel cash-stat"><span>Margem estimada</span><strong>{margin}%</strong></div></div>
    <div className="report-grid"><ChartPanel title="Vendas por período" subtitle="Valores guardados neste dispositivo" data={chartData} max={chartMax} total={chartTotal} range={chartRange} onRangeChange={onRangeChange} /><div className="panel"><div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="box" size={18} /></span>Produtos em destaque</h2></div><div className="report-products">{products.slice(0, 5).map((product) => { const units = sales.flatMap((sale) => sale.items).filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0); return <div className="report-product-row" key={product.id}><ProductThumbnail product={product} /><span><strong>{product.name}</strong><small>{units || 0} unidades vendidas</small></span><b>{money(product.price - product.cost)} / un.</b></div>; })}</div></div></div>
    <p className="panel-subtitle" style={{ margin: "15px 4px" }}>{soldUnits} unidades vendidas no histórico local. Despesas: {money(expenses.reduce((sum, expense) => sum + expense.amount, 0))}.</p>
  </>;
}
