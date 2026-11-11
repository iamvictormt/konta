import { useState, type FormEvent } from "react";
import type { CommerceData } from "../../../lib/model";
import FormField from "../../ui/form-field";
import MaskedNumberInput from "../../ui/masked-number-input";

export function StockConflictRow({ conflict, canResolve, online, onResolved }: { conflict: CommerceData["stockConflicts"][number]; canResolve: boolean; online: boolean; onResolved: () => void | Promise<void> }) {
  const [countedStock, setCountedStock] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(countedStock);
    if (!Number.isSafeInteger(count) || count < 0) {
      setMessage("Introduza uma contagem inteira igual ou superior a zero.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/commerce/stock-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflictId: conflict.id, countedStock: count }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Não foi possível reconciliar o stock.");
      }
      setMessage("Saldo reconciliado e ajuste registado.");
      await onResolved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reconciliar o stock.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="stock-conflict-row">
    <div><strong>{conflict.productName}</strong><small>Venda {conflict.saleId.slice(0, 8)} · dispositivo {conflict.deviceId.slice(0, 8)} · saldo após venda: {conflict.stockAfter}</small></div>
    {canResolve ? <form onSubmit={submit}><FormField id={`stock-count-${conflict.id}`} label="Contagem física"><MaskedNumberInput id={`stock-count-${conflict.id}`} minValue={0} required value={countedStock} onValueChange={setCountedStock} /></FormField><button className="button button-primary" type="submit" disabled={!online || saving}>{saving ? "A guardar…" : "Reconciliar"}</button></form> : <span className="role-note">Apenas administrador</span>}
    {message && <small className="stock-conflict-message" role="status">{message}</small>}
  </div>;
}
