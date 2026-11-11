import { useState, type FormEvent } from "react";
import type { Product } from "../../../lib/model";
import FormField from "../../ui/form-field";
import CustomSelect from "../../ui/custom-select";
import MaskedNumberInput from "../../ui/masked-number-input";
import { productSymbolOptions } from "../form-options";
import { Modal } from "../shared/modal";

export function ProductModal({ onClose, onSave }: { onClose: () => void; onSave: (product: Omit<Product, "id">) => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Geral");
  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [emoji, setEmoji] = useState("📦");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name: name.trim(), sku: sku.trim() || `PRD-${Date.now().toString().slice(-5)}`, category, stock: Math.max(0, Number(stock) || 0), price: Math.max(0, Math.round(Number(price) || 0)), cost: Math.max(0, Math.round(Number(cost) || 0)), emoji });
  }
  return <Modal title="Novo produto" subtitle="Adicione um artigo ao catálogo da loja." onClose={onClose}>
    <form onSubmit={submit}><div className="form-grid">
      <FormField id="product-name" label="Nome do produto" className="full"><input id="product-name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Cesto de palha" /></FormField>
      <FormField id="product-sku" label="Código"><input id="product-sku" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Gerado se vazio" /></FormField>
      <FormField id="product-category" label="Categoria"><input id="product-category" required value={category} onChange={(event) => setCategory(event.target.value)} /></FormField>
      <FormField id="product-price" label="Preço de venda (Db)"><MaskedNumberInput id="product-price" required minValue={1} value={price} onValueChange={setPrice} /></FormField>
      <FormField id="product-cost" label="Custo (Db)"><MaskedNumberInput id="product-cost" required minValue={0} value={cost} onValueChange={setCost} /></FormField>
      <FormField id="product-stock" label="Stock inicial"><MaskedNumberInput id="product-stock" minValue={0} value={stock} onValueChange={setStock} /></FormField>
      <FormField id="product-emoji" label="Símbolo"><CustomSelect id="product-emoji" value={emoji} onChange={setEmoji} variant="symbol" options={productSymbolOptions} /></FormField>
    </div><div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Guardar produto</button></div></form>
  </Modal>;
}
