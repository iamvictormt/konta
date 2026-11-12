import type { IconName } from "../ui-icon";
import type { Section } from "./types";

export const navItems: Array<{ id: Section; label: string; icon: IconName }> = [
  { id: "inicio", label: "Início", icon: "home" },
  { id: "vendas", label: "Vendas", icon: "cart" },
  { id: "produtos", label: "Produtos", icon: "box" },
  { id: "revendedores", label: "Revendedores", icon: "store" },
  { id: "relatorios", label: "Relatórios", icon: "chart" },
  { id: "caixa", label: "Caixa", icon: "cash" },
  { id: "loja", label: "Loja", icon: "settings" },
];

export const sectionPaths: Record<Section, string> = {
  inicio: "/loja", vendas: "/loja/vendas", produtos: "/loja/produtos", relatorios: "/loja/relatorios", caixa: "/loja/caixa", loja: "/loja/definicoes", revendedores: "/loja/revendedores",
};

export const pathSections = Object.fromEntries(
  Object.entries(sectionPaths).map(([section, route]) => [route, section]),
) as Record<string, Section>;
