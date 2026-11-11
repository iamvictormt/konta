import Icon from "../../ui-icon";
import CustomSelect from "../../ui/custom-select";
import type { Product } from "../../../lib/model";
import { compactMoney, greeting, money, percentChange } from "../format";
import type { Activity, ChartRange, ModalKind, Section } from "../types";
import { ActivityRow } from "../shared/activity-row";
import { ChartPanel } from "../shared/chart-panel";

const PERIOD_LABELS: Record<ChartRange, { total: string; previous: string }> = {
  week: { total: "Total da semana", previous: "à semana anterior" },
  month: { total: "Total do mês", previous: "ao período anterior" },
  year: { total: "Total do ano", previous: "ao período anterior" },
};

function Change({ value, reference, empty }: { value: number | null; reference: string; empty: string }) {
  if (value === null) return <span className="kpi-note">{empty}</span>;
  const up = value >= 0;
  return <span className={`kpi-change ${up ? "is-up" : "is-down"}`}><Icon className={up ? "" : "is-flipped"} name="arrow-up" size={13} />{up ? "+" : ""}{value}% <small>face {reference}</small></span>;
}

export function DashboardView({
  now, userName, canManageProducts, products, salesTotal, yesterdaySalesTotal, totalItems, cashBalance, cashSessionOpen, chartData, chartMax, chartTotal, previousChartTotal, topProduct, chartRange, onRangeChange, chartProduct, onProductChange, activity, onSectionChange, onOpenModal,
}: {
  now: Date | null; userName: string; canManageProducts: boolean; products: Product[]; salesTotal: number; yesterdaySalesTotal: number; totalItems: number; cashBalance: number; cashSessionOpen: boolean;
  chartData: Array<{ label: string; value: number }>; chartMax: number; chartTotal: number; previousChartTotal: number; topProduct: { product: Product; units: number } | null;
  chartRange: ChartRange; onRangeChange: (range: ChartRange) => void; chartProduct: string; onProductChange: (productId: string) => void; activity: Activity[];
  onSectionChange: (section: Section) => void; onOpenModal: (modal: ModalKind) => void;
}) {
  const labels = PERIOD_LABELS[chartRange];
  const productOptions = [{ value: "all", label: "Todos os produtos" }, ...products.map((product) => ({ value: product.id, label: product.name }))];

  return (
    <>
      <section className="home-intro">
        <h1>{greeting(now)}, {userName.split(" ")[0]}!</h1>
        <p>Aqui está o resumo da sua loja.</p>
        <div className="hero-rule" />
      </section>

      <dl className="kpi-grid" aria-label="Indicadores da loja">
        <div className="kpi-card">
          <span className="kpi-icon kpi-icon--green" aria-hidden="true"><Icon name="cart" size={30} /></span>
          <div className="kpi-body">
            <dt>Vendas de hoje</dt>
            <dd className="kpi-value">{money(salesTotal)}</dd>
            <dd><Change value={percentChange(salesTotal, yesterdaySalesTotal)} reference="a ontem" empty="Sem vendas ontem para comparar" /></dd>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon kpi-icon--deep" aria-hidden="true"><Icon name="box" size={30} /></span>
          <div className="kpi-body">
            <dt>Produtos em stock</dt>
            <dd className="kpi-value">{new Intl.NumberFormat("pt-PT").format(totalItems)}</dd>
            <dd><span className="kpi-note">{products.length} {products.length === 1 ? "produto" : "produtos"} no catálogo</span></dd>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon kpi-icon--gold" aria-hidden="true"><Icon name="cash" size={30} /></span>
          <div className="kpi-body">
            <dt>Caixa atual</dt>
            <dd className="kpi-value">{cashSessionOpen ? money(cashBalance) : "—"}</dd>
            <dd><span className="kpi-note">{cashSessionOpen ? "Sessão em curso neste dispositivo" : "Abra uma sessão para começar"}</span></dd>
          </div>
        </div>
      </dl>

      <ChartPanel
        title="Desempenho"
        data={chartData}
        max={chartMax}
        total={chartTotal}
        range={chartRange}
        onRangeChange={onRangeChange}
        filter={<div className="chart-product-filter"><label className="sr-only" htmlFor="chart-product">Filtrar desempenho por produto</label><CustomSelect id="chart-product" value={chartProduct} options={productOptions} onChange={onProductChange} /></div>}
        aside={
          <aside className="perf-aside" aria-label="Resumo do período">
            <div className="perf-total">
              <span className="perf-icon" aria-hidden="true"><Icon name="trend" size={26} /></span>
              <div>
                <span className="perf-label">{labels.total}</span>
                <strong className="perf-value">{compactMoney(chartTotal)}</strong>
                <Change value={percentChange(chartTotal, previousChartTotal)} reference={labels.previous} empty="Sem período anterior para comparar" />
              </div>
            </div>
            <div className="perf-top">
              <span className="perf-label"><Icon name="star" size={18} />Produto mais vendido</span>
              {topProduct
                ? <div className="perf-product"><span className="perf-product-art" aria-hidden="true">{topProduct.product.emoji}</span><div><strong>{topProduct.product.name}</strong><span>{topProduct.units} {topProduct.units === 1 ? "vendido" : "vendidos"}</span></div></div>
                : <p className="perf-empty">Ainda não há vendas neste período.</p>}
            </div>
          </aside>
        }
      />

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
