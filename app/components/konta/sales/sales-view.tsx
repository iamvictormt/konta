import { useState } from "react";
import Icon from "../../ui-icon";
import FormField from "../../ui/form-field";
import MaskedNumberInput from "../../ui/masked-number-input";
import type { Product } from "../../../lib/model";
import { money } from "../format";
import { PageHeading } from "../shared/page-heading";

export function SalesView({ products, cartLines, cartTotal, receivedAmount, changeAmount, sessionOpen, onOpenCash, onAdd, onChangeQuantity, onReceivedChange, onFinish }: { products: Product[]; cartLines: Array<{ product: Product; quantity: number }>; cartTotal: number; receivedAmount: string; changeAmount: number; sessionOpen: boolean; onOpenCash: () => void; onAdd: (id: string) => void; onChangeQuantity: (id: string, delta: number) => void; onReceivedChange: (value: string) => void; onFinish: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || product.sku.toLowerCase().includes(query.toLowerCase()));
  const received = Number(receivedAmount) || 0;
  return <>
    <PageHeading title="Nova venda" subtitle="Selecione os produtos e confirme o pagamento em dinheiro."><span className="demo-tag">Venda em dinheiro · Db</span></PageHeading>
    {!sessionOpen && <div className="offline-notice cash-session-notice"><Icon name="cash" size={17} /><span><strong>Caixa fechado.</strong> Abra uma sessão para registar vendas e controlar o dinheiro.</span><button className="button button-ghost" type="button" onClick={onOpenCash}>Abrir caixa<Icon name="arrow-right" size={14} /></button></div>}
    <div className="toolbar"><label className="search-box"><Icon name="search" size={17} /><input aria-label="Pesquisar produtos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar produtos" /></label><span className="status-pending"><span className="status-dot" />Guardada neste dispositivo</span></div>
    <div className="sales-layout">
      <div className="panel"><div className="panel-header"><h2 className="panel-title"><span className="panel-title-icon"><Icon name="box" size={18} /></span>Catálogo</h2><span className="panel-subtitle">Toque num artigo para adicionar</span></div><div className="sales-products">{filtered.map((product) => <button className="sale-product" key={product.id} type="button" onClick={() => onAdd(product.id)} disabled={!sessionOpen || product.stock < 1}><span className="product-emoji">{product.emoji}</span><span className="sale-product-info"><strong>{product.name}</strong><span>{product.stock} em stock · {product.sku}</span></span><strong className="sale-product-price">{money(product.price)}</strong></button>)}</div></div>
      <aside className="panel cart-panel"><div className="cart-heading"><h2>Venda atual</h2><span>{cartLines.reduce((total, item) => total + item.quantity, 0)} artigos</span></div>
        {cartLines.length === 0 ? <div className="cart-empty"><span><Icon name="cart" size={23} /><br />Adicione produtos para começar.</span></div> : <div className="cart-items">{cartLines.map(({ product, quantity }) => <div className="cart-item" key={product.id}><span><strong>{product.name}</strong><span>{money(product.price)} cada</span></span><span className="qty-control"><button type="button" aria-label={`Remover uma unidade de ${product.name}`} onClick={() => onChangeQuantity(product.id, -1)}><Icon name="minus" size={12} /></button><b>{quantity}</b><button type="button" aria-label={`Adicionar uma unidade de ${product.name}`} onClick={() => onChangeQuantity(product.id, 1)}><Icon name="plus" size={12} /></button></span></div>)}</div>}
        <div className="cart-totals"><div className="total-row"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><div className="total-row grand"><span>Total</span><strong>{money(cartTotal)}</strong></div></div>
        <FormField className="cash-input" id="amount-received" label="Valor recebido"><MaskedNumberInput id="amount-received" minValue={0} value={receivedAmount} onValueChange={onReceivedChange} placeholder="0" disabled={!sessionOpen} /></FormField>
        <div className="change-line"><span>Troco</span><strong>{money(changeAmount)}</strong></div>
        <button className="button button-primary cart-submit" type="button" disabled={!sessionOpen || !cartLines.length || received < cartTotal} onClick={onFinish}><Icon name="check" size={16} />Confirmar venda</button>
      </aside>
    </div>
  </>;
}
