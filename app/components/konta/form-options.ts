import type { CustomSelectOption } from "../ui/custom-select";

export const expenseCategoryOptions: CustomSelectOption[] = ["Operação", "Logística", "Renda", "Serviços", "Outra"].map((category) => ({ value: category, label: category }));
