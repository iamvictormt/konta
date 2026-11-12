import { useEffect, useState } from "react";
import { remainingUnits, type ConsignmentData } from "@/app/lib/consignment";
import type { CashSession, Product } from "@/app/lib/model";
import Icon from "../../ui-icon";
import CustomSelect from "../../ui/custom-select";
import FormField from "../../ui/form-field";
import { ActivityRow } from "../shared/activity-row";
import { dayLabel, money } from "../format";
import { PageHeading } from "../shared/page-heading";
import { ConsignmentForm, type ConsignmentAction } from "./consignment-form";

type Props = {
  online: boolean;
  products: Product[];
  deviceId: string;
  cash: CashSession | null;
  onRefreshCommerce: () => void;
  notify: (message: string) => void;
};

export function ResellersView({ online, products, deviceId, cash, onRefreshCommerce, notify }: Props) {
  const [data, setData] = useState<ConsignmentData>();
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [action, setAction] = useState<ConsignmentAction>();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const selected = data?.resellers.find((item) => item.id === selectedId) ?? data?.resellers[0];
  const deliveries = data?.deliveries.filter((line) => line.resellerId === selected?.id) ?? [];
  const events = data?.events.filter((event) => event.resellerId === selected?.id) ?? [];
  const units = deliveries.reduce((sum, line) => sum + remainingUnits(line), 0);
  const ready = online && !loading && !error && Boolean(deviceId);

  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    fetch("/api/commerce/resellers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json() as ConsignmentData;
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar os revendedores."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [online, revision]);

  function refresh() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  return <>
    <PageHeading className="consignment-heading" title="Revendedores" subtitle="Acompanhe o stock em consignação, os acertos e os pagamentos.">
      <button type="button" className="button button-ghost" disabled={!ready || products.length === 0} onClick={() => setAction("stock")}><Icon name="box" size={16} />Registar produção</button>
      <button type="button" className="button button-primary" disabled={!ready} onClick={() => setAction("reseller")}><Icon name="plus" size={16} />Novo revendedor</button>
    </PageHeading>
    {!online && <div className="offline-notice"><Icon name="wifi-off" size={17} /><span>Ligue-se à internet para gerir as consignações.</span></div>}
    {online && loading && !data && <p className="panel empty-row" role="status">A carregar revendedores…</p>}
    {online && error && <div className="panel settings-panel"><p role="alert" className="settings-form-error">{error}</p><button type="button" className="button button-ghost" onClick={refresh}>Tentar novamente</button></div>}
    {online && data && !error && (selected ? <div className="consignment-stack" aria-busy={loading}>
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><span className="panel-title-icon"><Icon name="store" size={18} /></span>Ficha do revendedor</h2>
          <FormField id="selected-reseller" label="Revendedor" className="consignment-selector">
            <CustomSelect id="selected-reseller" value={selected.id} onChange={setSelectedId}
              options={data.resellers.map((reseller) => ({ value: reseller.id, label: reseller.name }))}
            />
          </FormField>
        </div>
        <div className="panel-action-row">
          <button type="button" className="button button-primary" disabled={!ready || !products.some((product) => product.active !== false && product.stock > 0)} onClick={() => setAction("delivery")}>Registar entrega</button>
          <button type="button" className="button button-ghost" disabled={!ready || units === 0} onClick={() => setAction("settlement")}>Registar acerto do mês</button>
          <button type="button" className="button button-ghost" disabled={!ready || selected.billed <= selected.received} onClick={() => setAction("payment")}>Registar recebimento</button>
          <button type="button" className="button button-ghost" disabled={!ready || units === 0} onClick={() => setAction("return")}>Registar devolução</button>
        </div>
      </section>
      <div className="cash-summary consignment-summary">
        <div className="panel cash-stat"><span>Unidades em consignação</span><strong>{units}</strong></div>
        <div className="panel cash-stat"><span>Valor recebido</span><strong>{money(selected.received)}</strong></div>
        <div className="panel cash-stat"><span>Saldo a receber</span><strong>{money(selected.billed - selected.received)}</strong></div>
      </div>
      <section className="panel product-table">
        <div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="box" size={18} /></span>Entregas</h2></div>
        {deliveries.length === 0 ? <div className="empty-row">Ainda não há entregas para este revendedor.</div> : <div className="table-scroll">
          <table aria-label="Entregas">
            <thead><tr><th>Produto e data</th><th>Valor por un.</th><th>Entregues</th><th>Vendidas</th><th>Devolvidas</th><th>Com o revendedor</th></tr></thead>
            <tbody>{deliveries.map((line) => <tr key={line.id}>
              <td><strong>{line.productName}</strong><br />{dayLabel(new Date(line.createdAt), { dateStyle: "short" })}</td>
              <td>{money(line.unitPrice)}</td><td>{line.delivered}</td><td>{line.sold}</td><td>{line.returned}</td><td>{remainingUnits(line)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
      <section className="panel cash-session-section">
        <div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="receipt" size={18} /></span>Acertos e recebimentos</h2></div>
        <div className="activity-list">
          {events.length === 0 ? <div className="empty-row cash-empty-state">Ainda não há acertos nem recebimentos.</div> : events.map((event) => (
            <ActivityRow key={`${event.kind}:${event.id}`} icon={event.kind === "settlement" ? "receipt" : "cash"} showSign={event.kind !== "settlement"} item={{
              id: event.id,
              kind: "sale",
              title: event.kind === "settlement" ? `Acerto de ${event.period}` : event.kind === "cash" ? "Recebimento em dinheiro" : "Recebimento por transferência",
              detail: dayLabel(new Date(event.createdAt), { dateStyle: "short" }),
              createdAt: event.createdAt,
              amount: event.amount,
            }} />
          ))}
        </div>
      </section>
    </div> : <div className="panel empty-row">Crie um revendedor para registar a primeira entrega.</div>)}
    {action && <ConsignmentForm action={action} online={online} reseller={action === "reseller" || action === "stock" ? undefined : selected}
      products={products} deliveries={deliveries} deviceId={deviceId} cash={cash}
      onClose={() => setAction(undefined)} onSaved={() => {
        setAction(undefined);
        notify("Registo guardado.");
        refresh();
        onRefreshCommerce();
      }}
    />}
  </>;
}
