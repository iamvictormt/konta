import type { StoreModuleId } from "../../lib/store-modules";

export type SupportAccess = { id: string; reason: string; expiresAt: string };

export type PlatformStore = {
  id: string;
  name: string;
  countryCode: string | null;
  currency: string;
  createdAt: string;
  status: "active" | "inactive";
  enabledModules: StoreModuleId[];
  owner: { id: string; name: string; email: string; createdAt: string | null; active: boolean } | null;
  lastSyncAt: string | null;
  supportAccess: SupportAccess | null;
};

export type CreateStoreInput = {
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  initialPassword: string;
  enabledModules: StoreModuleId[];
};

export type FinancialSummary = {
  sales: number;
  costs: number;
  expenses: number;
  profit: number;
  margin: number | null;
  salesCount: number;
  accessReason: string;
  grantId: string;
  expiresAt: string;
};

