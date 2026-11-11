import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import Image from "next/image";
import type { Product } from "../../../lib/model";
import Icon from "../../ui-icon";
import FormField from "../../ui/form-field";
import { createId } from "../../../lib/offline-store";
import MaskedNumberInput from "../../ui/masked-number-input";
import { Modal } from "../shared/modal";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
// Os mesmos tipos que o servidor aceita (/api/commerce/products/image), para o erro aparecer logo ao escolher.
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Alguns navegadores deixam o tipo vazio em ficheiros HEIC; o servidor precisa dele no cabeçalho. */
function photoType(file: File) {
  if (PHOTO_TYPES.has(file.type)) return file.type;
  if (file.type) return "";
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") ? "image/heic" : name.endsWith(".heif") ? "image/heif" : "";
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ProductModal({ product, onClose, onSave }: { product?: Product; onClose: () => void; onSave: (product: Omit<Product, "id">, photo?: { file: File; productId: string }) => Promise<void> }) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState(product?.category ?? "Geral");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [cost, setCost] = useState(product ? String(product.cost) : "");
  const [active, setActive] = useState(product?.active !== false);
  // A foto fica só em memória (com uma pré-visualização local) e só é enviada quando o produto é guardado.
  const [photo, setPhoto] = useState<{ file: File; productId: string; previewUrl: string }>();
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [dragging, setDragging] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function dropPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
  }

  function selectPhoto(picked?: File) {
    if (!picked) return;
    const type = photoType(picked);
    if (!type) {
      setPhotoError("Escolha uma foto JPG, PNG, WebP ou HEIC.");
      return;
    }
    const file = type === picked.type ? picked : new File([picked], picked.name, { type });
    if (!file.size || file.size > MAX_PHOTO_BYTES) {
      setPhotoError("A foto deve ter até 8 MB.");
      return;
    }
    dropPreview();
    previewRef.current = URL.createObjectURL(file);
    setPhotoError("");
    setPhoto({ file, productId: photo?.productId ?? createId(), previewUrl: previewRef.current });
  }

  function removePhoto() {
    dropPreview();
    setPhoto(undefined);
    setPhotoError("");
  }

  function dropPhoto(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) selectPhoto(event.dataTransfer.files?.[0]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || photoError) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), sku: sku.trim() || `PRD-${Date.now().toString().slice(-5)}`, category, stock: Math.max(0, Number(stock) || 0), price: Math.max(0, Math.round(Number(price) || 0)), cost: Math.max(0, Math.round(Number(cost) || 0)), emoji: product?.emoji ?? "📦", imageUrl: product?.imageUrl, active }, photo && { file: photo.file, productId: photo.productId });
    } finally {
      setBusy(false);
    }
  }
  return <Modal title={product ? "Editar produto" : "Novo produto"} subtitle={product ? "Actualize os dados do catálogo ou altere a disponibilidade nas vendas." : "Adicione um artigo ao catálogo da loja."} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={(event) => void submit(event)}><div className="form-grid">
      {!product && <div className="form-field full photo-field" role="group" aria-labelledby="product-photo-label">
        <span id="product-photo-label" className="photo-field-label">Foto do produto <small>(opcional)</small></span>
        <input ref={photoInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" tabIndex={-1} onChange={(event) => { selectPhoto(event.target.files?.[0]); event.target.value = ""; }} />
        {photo ? <div className="photo-preview">
          <Image className="photo-preview-image" src={photo.previewUrl} alt="Pré-visualização da foto do produto" width={160} height={160} unoptimized />
          <div className="photo-preview-info">
            <strong title={photo.file.name}>{photo.file.name}</strong>
            <span>{formatBytes(photo.file.size)}</span>
            <div className="photo-preview-actions">
              <button type="button" className="button button-ghost" disabled={busy} onClick={() => photoInput.current?.click()}><Icon name="camera" size={16} />Trocar</button>
              <button type="button" className="button photo-remove" disabled={busy} onClick={removePhoto}><Icon name="trash" size={16} />Excluir</button>
            </div>
          </div>
        </div> : <label className={`photo-drop ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={dropPhoto}>
          <button id="product-photo" type="button" className="photo-drop-button" disabled={busy} onClick={() => photoInput.current?.click()}>
            <span className="photo-drop-icon"><Icon name="camera" size={26} /></span>
            <strong>Adicionar foto</strong>
            <span>Tire uma foto ou escolha da galeria</span>
            <small>JPG, PNG ou WebP · até 8 MB</small>
          </button>
        </label>}
        {photoError ? <p className="photo-error" role="alert">{photoError}</p> : <p className="photo-hint">A foto só é enviada quando clicar em Guardar produto.</p>}
      </div>}
      <FormField id="product-name" label="Nome do produto" className="full"><input id="product-name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Cesto de palha" /></FormField>
      <FormField id="product-sku" label="Código"><input id="product-sku" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Gerado se vazio" /></FormField>
      <FormField id="product-category" label="Categoria"><input id="product-category" required value={category} onChange={(event) => setCategory(event.target.value)} /></FormField>
      <FormField id="product-price" label="Preço de venda (Db)"><MaskedNumberInput id="product-price" required minValue={product ? 0 : 1} value={price} onValueChange={setPrice} /></FormField>
      <FormField id="product-cost" label="Custo (Db)"><MaskedNumberInput id="product-cost" required minValue={0} value={cost} onValueChange={setCost} /></FormField>
      {!product && <FormField id="product-stock" label="Stock inicial"><MaskedNumberInput id="product-stock" minValue={0} value={stock} onValueChange={setStock} /></FormField>}
      {product && <label className="form-field full product-status"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Disponível para venda</label>}
    </div><div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy || !!photoError}>{busy ? "A guardar…" : "Guardar produto"}</button></div></form>
  </Modal>;
}
