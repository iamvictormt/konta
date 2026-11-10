export type SyncState = "synced" | "pending" | "failed";

export type Product = {
  id: string;
  name: string;
  category: string;
  sku: string;
  stock: number;
  price: number;
  cost: number;
  emoji: string;
};

export type SaleLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export type Sale = {
  id: string;
  createdAt: string;
  items: SaleLine[];
  total: number;
  received: number;
  change: number;
  syncState: SyncState;
  demo?: boolean;
};

export type Expense = {
  id: string;
  createdAt: string;
  description: string;
  category: string;
  amount: number;
  syncState: SyncState;
  demo?: boolean;
};

export type OutboxOperation = {
  id: string;
  type: "product.save" | "sale.create" | "expense.create";
  createdAt: string;
  actorId: string;
  deviceId: string;
  state: "pending" | "failed";
  lastError?: string;
  payload: Product | Sale | Expense;
};

export type StockConflict = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  deviceId: string;
  quantitySold: number;
  stockBefore: number;
  stockAfter: number;
  createdAt: string;
};

export type CommerceProfile = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "collaborator";
  organizationId: string;
};

export type CommerceData = {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  stockConflicts: StockConflict[];
};

export const OPENING_CASH = 0;
