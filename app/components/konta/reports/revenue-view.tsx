import { useEffect, useState } from "react";
import { money } from "../format";
import { PageHeading } from "../shared/page-heading";
import Icon from "../../ui-icon";

const periods = ["7", "30", "365"] as const;
type Period = typeof periods[number];
type Revenue = { total: number; salesCount: number };

export function RevenueView({ online }: { online: boolean }) {
  const [period, setPeriod] = useState<Period>("30");
  const [result, setResult] = useState<{ period: Period; revenue?: Revenue; error?: string }>();
  const [reload, setReload] = useState(0);
  const current = result?.period === period ? result : undefined;

  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    fetch(`/api/commerce/revenue?days=${period}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 403) throw new Error("A sua conta não tem acesso à faturação.");
        if (!response.ok) throw new Error("Não foi possível carregar a faturação.");
        const revenue = await response.json() as Revenue;
        if (!controller.signal.aborted) setResult({ period, revenue });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setResult({ period, error: error.message });
      });
    return () => controller.abort();
  }, [online, period, reload]);

  return <>
    <PageHeading title="Faturação" subtitle="Vendas sincronizadas de toda a loja." />
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title"><span className="panel-title-icon"><Icon name="calendar" size={18} /></span>Período da faturação</h2>
      </div>
      <div className="panel-action-row" role="group" aria-label="Período da faturação">
        {periods.map((days) => <button key={days} type="button" aria-pressed={period === days}
          className={`button ${period === days ? "button-primary" : "button-ghost"}`}
          onClick={() => { if (period !== days) setResult(undefined); setPeriod(days); }}
        >Últimos {days} dias</button>)}
      </div>
      {!online ? <p className="empty-row">Ligue-se à internet para consultar a faturação.</p> : current?.error ? <div className="empty-row">
        <p role="alert">{current.error}</p>
        <button type="button" className="button button-ghost" onClick={() => { setResult(undefined); setReload((value) => value + 1); }}>Tentar novamente</button>
      </div> : !current?.revenue && <p className="empty-row" role="status">A carregar a faturação…</p>}
    </section>
    {online && current?.revenue && <div className="cash-summary">
      <div className="panel cash-stat"><span>Total vendido</span><strong>{money(current.revenue.total)}</strong></div>
      <div className="panel cash-stat"><span>Vendas registadas</span><strong>{current.revenue.salesCount}</strong></div>
    </div>}
  </>;
}
