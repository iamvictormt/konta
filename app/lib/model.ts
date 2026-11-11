import type { StoreModuleId } from "./store-modules";

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
  active?: boolean;
  imageUrl?: string;
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
  cashSessionId?: string;
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
  cashSessionId?: string;
  description: string;
  category: string;
  amount: number;
  syncState: SyncState;
  demo?: boolean;
};

export type CashSession = {
  id: string;
  deviceId: string;
  openedBy: string;
  openedByName?: string;
  openedAt: string;
  openingAmount: number;
  status: "open" | "closed";
  closedBy?: string;
  closedByName?: string;
  closedAt?: string;
  expectedAmount?: number;
  countedAmount?: number;
  differenceAmount?: number;
  syncState: SyncState;
};

export type OutboxOperation = {
  id: string;
  type: "product.save" | "sale.create" | "expense.create" | "cash-session.open" | "cash-session.close";
  createdAt: string;
  actorId: string;
  deviceId: string;
  sequence?: number;
  state: "pending" | "failed";
  lastError?: string;
  payload: Product | Sale | Expense | CashSession;
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
  enabledModules: StoreModuleId[];
  isOwner: boolean;
  isPlatformAdmin: boolean;
};

export type CommerceData = {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  cashSessions: CashSession[];
  stockConflicts: StockConflict[];
};
