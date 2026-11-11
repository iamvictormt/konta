export const STORE_MODULES = [
  { id: "commerce", label: "Lojas e Comércio", description: "Produtos, stock, vendas, caixa e relatórios." },
  { id: "services", label: "Empresas e Serviços", description: "Clientes, projectos, receitas e custos." },
  { id: "training", label: "Formação de Alunos", description: "Cursos, turmas, inscrições e certificados." },
] as const;

export type StoreModuleId = (typeof STORE_MODULES)[number]["id"];

export const STORE_MODULE_ROUTES: Record<StoreModuleId, string> = {
  commerce: "/loja",
  services: "/servicos",
  training: "/formacao",
};

export function moduleForPath(pathname: string): StoreModuleId {
  if (pathname === "/servicos" || pathname.startsWith("/servicos/")) return "services";
  if (pathname === "/formacao" || pathname.startsWith("/formacao/")) return "training";
  return "commerce";
}

export const STORE_MODULE_IDS = STORE_MODULES.map((module) => module.id) as [StoreModuleId, ...StoreModuleId[]];

export function isStoreModuleId(value: unknown): value is StoreModuleId {
  return typeof value === "string" && STORE_MODULES.some((module) => module.id === value);
}
