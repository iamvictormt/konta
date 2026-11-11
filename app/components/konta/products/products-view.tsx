import { useState } from "react";
import Icon from "../../ui-icon";
import type { Product } from "../../../lib/model";
import { money } from "../format";
import { PageHeading } from "../shared/page-heading";

export function ProductsView({ products, canViewCosts, onAdd }: { products: Product[]; canViewCosts: boolean; onAdd?: () => void }) {
  const [query, setQuery] = useState("");
  const visibleProducts = products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading title="Produtos" subtitle="Acompanhe o catálogo e os níveis de stock.">{onAdd && <button className="button button-primary" type="button" onClick={onAdd}><Icon name="plus" size={16} />Novo produto</button>}</PageHeading>
    <div className="toolbar"><label className="search-box"><Icon name="search" size={17} /><input aria-label="Pesquisar produtos por nome, código ou categoria" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, código ou categoria" /></label><span className="demo-tag">{products.length} produtos</span></div>
    <div className="panel product-table"><div className="table-scroll"><table><thead><tr><th>Produto</th><th>Código</th><th>Preço</th>{canViewCosts && <th>Custo</th>}<th>Stock</th>{canViewCosts && <th>Margem</th>}</tr></thead><tbody>
      {visibleProducts.map((product) => <tr key={product.id}><td><span className="table-product"><span className="product-emoji">{product.emoji}</span><span><strong>{product.name}</strong><span>{product.category}</span></span></span></td><td>{product.sku}</td><td>{money(product.price)}</td>{canViewCosts && <td>{money(product.cost)}</td>}<td><span className={`stock-pill ${product.stock <= 0 ? "out" : product.stock < 10 ? "low" : ""}`}>{product.stock} un.</span></td>{canViewCosts && <td>{product.price > 0 ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : "—"}</td>}</tr>)}
      {visibleProducts.length === 0 && <tr><td className="empty-row" colSpan={canViewCosts ? 6 : 4}>Nenhum produto corresponde à pesquisa.</td></tr>}
    </tbody></table></div></div>
  </>;
}
