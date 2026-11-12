import { useRef, useState, type FormEvent } from "react";
import { remainingUnits, type Delivery, type Reseller } from "@/app/lib/consignment";
import type { CashSession, Product } from "@/app/lib/model";
import { createId } from "@/app/lib/offline-store";
import CustomSelect from "../../ui/custom-select";
import FormField from "../../ui/form-field";
import MaskedNumberInput from "../../ui/masked-number-input";
import { money, dayLabel } from "../format";
import { Modal } from "../shared/modal";

export type ConsignmentAction = "reseller" | "stock" | "delivery" | "return" | "settlement" | "payment";
const titles: Record<ConsignmentAction, string> = {
  reseller: "Novo revendedor",
  stock: "Registar produção",
  delivery: "Registar entrega",
  return: "Registar devolução",
  settlement: "Registar acerto do mês",
  payment: "Registar recebimento",
};

type Props = {
  action: ConsignmentAction;
  reseller?: Reseller;
  products: Product[];
  deliveries: Delivery[];
  deviceId: string;
  cash: CashSession | null;
  online: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function ConsignmentForm({ action, reseller, products, deliveries, deviceId, cash, online, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: "", unitPrice: "" }]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submission = useRef<{ payload: string; id: string } | null>(null);
  const available = deliveries.filter((line) => remainingUnits(line) > 0);
  const saleTotal = available.reduce((sum, line) => sum + Number(quantities[line.id] ?? 0) * line.unitPrice, 0);
  const due = (reseller ? reseller.billed - reseller.received : 0) + (action === "settlement" ? saleTotal : 0);
  const paymentAmount = Number(amount);
  const hasCash = cash?.syncState === "synced";
  const productOptions = [{ value: "", label: "Seleccione o produto" }, ...products
    .filter((product) => action === "stock" || (product.active !== false && product.stock > 0))
    .map((product) => ({ value: product.id, label: `${product.name} · ${product.stock} un.` }))];

  function updateLine(index: number, changes: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line, position) => position === index ? { ...line, ...changes } : line));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    setError("");
    if (paymentAmount > due || (paymentAmount > 0 && method === "cash" && !hasCash)) {
      setError(paymentAmount > due ? "O pagamento ultrapassa o saldo a receber." : "Abra e sincronize o caixa para receber em dinheiro.");
      return;
    }
    const payment = paymentAmount > 0 ? { amount: paymentAmount, method, cashSessionId: method === "cash" ? cash?.id : undefined } : undefined;
    const changes = available.flatMap((line) => {
      const quantity = Number(quantities[line.id] ?? 0);
      return quantity > 0 ? [{ deliveryId: line.id, quantity }] : [];
    });
    const selectedProducts = lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }));
    let data: object;
    switch (action) {
      case "reseller": data = { name }; break;
      case "stock": data = selectedProducts[0]; break;
      case "delivery": data = { resellerId: reseller?.id, lines: selectedProducts }; break;
      case "return": data = { resellerId: reseller?.id, lines: changes }; break;
      case "settlement": data = { resellerId: reseller?.id, lines: changes, period, payment }; break;
      case "payment": data = { resellerId: reseller?.id, payment }; break;
    }
    const payload = JSON.stringify({ ...data, kind: action, deviceId });
    if (submission.current?.payload !== payload) submission.current = { payload, id: createId() };
    setBusy(true);
    try {
      const response = await fetch("/api/commerce/resellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind: action, deviceId, requestId: submission.current.id }),
        signal: AbortSignal.timeout(12_000),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar o registo.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "Error" ? cause.message : "Não foi possível confirmar o registo. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const productForm = action === "stock" || action === "delivery";
  const quantityForm = action === "return" || action === "settlement";
  const paymentForm = action === "payment" || action === "settlement";
  const canSave = (!productForm || lines.every((line) => line.productId && Number(line.quantity) > 0))
    && (!quantityForm || Object.values(quantities).some((value) => Number(value) > 0));

  return <Modal title={titles[action]} subtitle={reseller?.name ?? (action === "stock" ? "Dê entrada das unidades produzidas no stock da loja." : "Crie uma ficha para acompanhar as entregas e os pagamentos.")} onClose={() => { if (!busy) onClose(); }}>
    <form className="consignment-form" onSubmit={save}>
      {action === "reseller" && <FormField id="reseller-name" label="Nome do revendedor"><input id="reseller-name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></FormField>}
      {productForm && <>
        {lines.map((line, index) => <fieldset key={index} className="form-grid consignment-form-line">
          <legend>{action === "delivery" ? `Artigo ${index + 1}` : "Produto produzido"}</legend>
          <FormField id={`delivery-product-${index}`} label="Produto" className="full">
            <CustomSelect id={`delivery-product-${index}`} value={line.productId} options={productOptions} onChange={(productId) => updateLine(index, { productId })} />
          </FormField>
          <FormField id={`delivery-count-${index}`} label="Quantidade"><MaskedNumberInput id={`delivery-count-${index}`} minValue={1} required value={line.quantity} onValueChange={(quantity) => updateLine(index, { quantity })} /></FormField>
          {action === "delivery" && <FormField id={`delivery-price-${index}`} label="Valor combinado por un. (Db)"><MaskedNumberInput id={`delivery-price-${index}`} minValue={1} required value={line.unitPrice} onValueChange={(unitPrice) => updateLine(index, { unitPrice })} /></FormField>}
          {lines.length > 1 && <button type="button" className="button button-ghost" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>Remover artigo</button>}
        </fieldset>)}
        {action === "delivery" && lines.length < 100 && <button className="button button-ghost" type="button" onClick={() => setLines((current) => [...current, { productId: "", quantity: "", unitPrice: "" }])}>Adicionar artigo</button>}
      </>}
      {action === "settlement" && <FormField id="settlement-period" label="Mês do acerto"><input id="settlement-period" type="month" required value={period} onChange={(event) => setPeriod(event.target.value)} /></FormField>}
      {quantityForm && available.map((line, index) => (
        <FormField key={line.id} id={`consignment-count-${index}`} label={`${line.productName} · ${remainingUnits(line)} un. disponíveis · ${dayLabel(new Date(line.createdAt), { dateStyle: "short" })} · ${money(line.unitPrice)}/un.`}>
          <MaskedNumberInput id={`consignment-count-${index}`} minValue={0} maxValue={remainingUnits(line)} placeholder={action === "return" ? "Quantidade devolvida" : "Quantidade vendida"} value={quantities[line.id] ?? ""} onValueChange={(value) => setQuantities((current) => ({ ...current, [line.id]: value }))} />
        </FormField>
      ))}
      {paymentForm && <>
        {action === "settlement" && <p>Vendas deste acerto <strong>{money(saleTotal)}</strong></p>}
        <p>Saldo a receber <strong>{money(due)}</strong></p>
        <FormField id="reseller-payment-amount" label={action === "settlement" ? "Valor recebido agora (opcional)" : "Valor recebido (Db)"}>
          <MaskedNumberInput id="reseller-payment-amount" minValue={action === "payment" ? 1 : 0} maxValue={due} required={action === "payment"} value={amount} onValueChange={setAmount} />
        </FormField>
        {paymentAmount > 0 && <FormField id="reseller-payment-method" label="Meio de pagamento">
          <CustomSelect id="reseller-payment-method" value={method} onChange={setMethod} options={[{ value: "transfer", label: "Transferência" }, { value: "cash", label: "Dinheiro" }]} />
        </FormField>}
        {paymentAmount > 0 && method === "cash" && !hasCash && <p>Abra e sincronize o caixa para receber em dinheiro.</p>}
      </>}
      {error && <p role="alert" className="photo-error">{error}</p>}
      {!online && <p>Ligue-se à internet para guardar o registo.</p>}
      <div className="modal-actions">
        <button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={busy || !online || !canSave}>{busy ? "A guardar…" : "Guardar registo"}</button>
      </div>
    </form>
  </Modal>;
}
