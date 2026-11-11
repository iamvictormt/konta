import type { ReactNode } from "react";
import Icon from "../../ui-icon";
import { money } from "../format";
import type { ChartRange } from "../types";

const RANGE_OPTIONS: Array<{ id: ChartRange; label: string }> = [
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "year", label: "Este ano" },
];

const TICK_COUNT = 3;

/** Escala "redonda" (1, 2, 5 × 10ⁿ) para que o eixo termine em valores legíveis como 5k, 10k, 15k. */
function niceScale(max: number) {
  const target = max > 0 ? max * 1.04 : 3000;
  const rough = target / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
  return { step, top: step * TICK_COUNT };
}

function axisLabel(value: number) {
  if (value === 0) return "0";
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(Math.round(value));
}

function barLabel(value: number) {
  if (value <= 0) return "–";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
}

type ChartPanelProps = {
  title: string;
  subtitle?: string;
  data: Array<{ label: string; value: number }>;
  max: number;
  total: number;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  /** Controlos extra no cabeçalho, ao lado do seletor de período. */
  filter?: ReactNode;
  /** Substitui o resumo lateral predefinido. */
  aside?: ReactNode;
};

export function ChartPanel({ title, subtitle, data, max, total, range, onRangeChange, filter, aside }: ChartPanelProps) {
  const { step, top } = niceScale(data.some((point) => point.value > 0) ? max : 0);
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => step * (TICK_COUNT - index));

  return (
    <div className="panel chart-panel">
      <div className="panel-header chart-panel-header">
        <div><h2 className="panel-title"><span className="panel-title-icon"><Icon name="bars" size={20} /></span>{title}</h2>{subtitle && <p className="panel-subtitle">{subtitle}</p>}</div>
        <div className="chart-controls">
          <div className="range-tabs" role="tablist" aria-label="Período do gráfico">
            {RANGE_OPTIONS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={range === item.id} className={range === item.id ? "selected" : ""} onClick={() => onRangeChange(item.id)}>
                <Icon name="calendar" size={15} />{item.label}
              </button>
            ))}
          </div>
          {filter}
        </div>
      </div>
      <div className="chart-area">
        <div className="bar-chart">
          <div className="chart-plot">
            <div className="chart-canvas">
              <div className="chart-y-labels" aria-hidden="true">{ticks.map((tick) => <span key={tick}>{axisLabel(tick)}</span>)}</div>
              <div className="chart-gridlines" aria-hidden="true">{ticks.map((tick) => <span key={tick} />)}</div>
              <div className="bars">
                {data.map((point, index) => (
                  <div className="bar-column" key={`${point.label}-${index}`} title={money(point.value)}>
                    <span className="bar-value">{barLabel(point.value)}</span>
                    <span className="bar" style={{ height: `${point.value > 0 ? Math.max(2, (point.value / top) * 100) : 0}%` }} />
                    <span className="bar-label">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {aside ?? (
          <div className="chart-summary">
            <div className="summary-block">
              <span className="summary-icon"><Icon name="trend" size={19} /></span>
              <span className="summary-label">Total do período</span>
              <strong className="summary-value">{money(total)}</strong>
              <span className="summary-change">{data.filter((point) => point.value > 0).length} períodos com vendas</span>
            </div>
            <div className="summary-block">
              <span className="summary-label">Margem estimada</span>
              <strong className="summary-value">—</strong>
              <span className="summary-change">Detalhe disponível nos relatórios</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
