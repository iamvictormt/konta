export type Reseller = { id: string; name: string; billed: number; received: number };
export type Delivery = {
  id: string;
  resellerId: string;
  productName: string;
  delivered: number;
  sold: number;
  returned: number;
  unitPrice: number;
  createdAt: string;
};
export type ResellerEvent = {
  id: string;
  resellerId: string;
  amount: number;
  createdAt: string;
  kind: "settlement" | "cash" | "transfer";
  period: string | null;
};
export type ConsignmentData = { resellers: Reseller[]; deliveries: Delivery[]; events: ResellerEvent[] };

export function remainingUnits(delivery: Delivery) {
  return delivery.delivered - delivery.sold - delivery.returned;
}
