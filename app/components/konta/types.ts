import type { Product } from "../../lib/model";

export type Section = "inicio" | "vendas" | "produtos" | "relatorios" | "caixa" | "loja";
export type CartLine = { productId: string; quantity: number };
export type SaleCartLine = { product: Product; quantity: number };
export type ChartRange = "week" | "month" | "year";
export type Activity = { id: string; createdAt: string; title: string; detail: string; amount: number; kind: "sale" | "expense" };
