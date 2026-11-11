import { useState, type FormEvent } from "react";
import type { Expense } from "../../../lib/model";
import FormField from "../../ui/form-field";
import CustomSelect from "../../ui/custom-select";
import MaskedNumberInput from "../../ui/masked-number-input";
import { expenseCategoryOptions } from "../form-options";
import { Modal } from "../shared/modal";

export function ExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (expense: Omit<Expense, "id" | "createdAt" | "syncState">) => void }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Operação");
  const [amount, setAmount] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ description: description.trim(), category, amount: Math.round(Number(amount) || 0) });
  }
  return <Modal title="Lançar despesa" subtitle="O valor será registado no caixa local." onClose={onClose}>
    <form onSubmit={submit}><div className="form-grid">
      <FormField id="expense-description" label="Descrição" className="full"><input id="expense-description" required autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Transporte de mercadoria" /></FormField>
      <FormField id="expense-category" label="Categoria"><CustomSelect id="expense-category" value={category} onChange={setCategory} options={expenseCategoryOptions} /></FormField>
      <FormField id="expense-amount" label="Valor (Db)"><MaskedNumberInput id="expense-amount" required minValue={1} value={amount} onValueChange={setAmount} /></FormField>
    </div><div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Guardar despesa</button></div></form>
  </Modal>;
}
