import type { CustomSelectOption } from "../ui/custom-select";

export const productSymbolOptions: CustomSelectOption[] = ["📦", "🧺", "🏺", "👜", "🎭", "📿"].map((symbol) => ({ value: symbol, label: symbol }));
export const expenseCategoryOptions: CustomSelectOption[] = ["Operação", "Logística", "Renda", "Serviços", "Outra"].map((category) => ({ value: category, label: category }));
