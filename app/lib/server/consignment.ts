import "server-only";

import { z } from "zod";
import type { ConsignmentData, Delivery, Reseller, ResellerEvent } from "../consignment";
import type { CommerceActor } from "./actor";
import { execute, inTransaction, queryAll, queryOne, type SqlExecutor, type SqlRow } from "./db";

const id = z.string().min(1).max(160);
const quantity = z.number().int().min(1).max(100_000);
const amount = z.number().int().min(1).max(2_000_000_000);
const deliveryLines = z.array(z.object({ productId: id, quantity, unitPrice: amount })).min(1).max(100);
const changes = z.array(z.object({ deliveryId: id, quantity })).min(1).max(100);
const payment = z.discriminatedUnion("method", [
  z.object({ method: z.literal("transfer"), amount }),
  z.object({ method: z.literal("cash"), amount, cashSessionId: z.uuid() }),
]);

export const consignmentRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reseller"), name: z.string().trim().min(2).max(120) }),
  z.object({ kind: z.literal("stock"), productId: id, quantity }),
  z.object({ kind: z.literal("delivery"), resellerId: id, lines: deliveryLines }),
  z.object({ kind: z.literal("return"), resellerId: id, lines: changes }),
  z.object({ kind: z.literal("settlement"), resellerId: id, period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), lines: changes, payment: payment.optional() }),
  z.object({ kind: z.literal("payment"), resellerId: id, payment }),
]).and(z.object({ requestId: z.uuid(), deviceId: id }));

type Request = z.infer<typeof consignmentRequest>;
type Payment = z.infer<typeof payment>;

export class ConsignmentError extends Error {}

export async function readConsignment(organizationId: string): Promise<ConsignmentData> {
  const [resellers, deliveries, events] = await Promise.all([
    queryAll<SqlRow & Omit<Reseller, "billed" | "received"> & { billed: string; received: string }>(
      `SELECT r.id, r.name,
        COALESCE((SELECT SUM(s.total) FROM commerce_sales s WHERE s.organization_id = r.organization_id AND s.reseller_id = r.id), 0) AS billed,
        COALESCE((SELECT SUM(p.amount) FROM commerce_reseller_receipts p WHERE p.organization_id = r.organization_id AND p.reseller_id = r.id), 0) AS received
       FROM commerce_resellers r WHERE r.organization_id = $1 ORDER BY lower(r.name)`, [organizationId],
    ),
    queryAll<SqlRow & Delivery>(
      `SELECT id, reseller_id AS "resellerId", product_name AS "productName", delivered, sold, returned,
              unit_price AS "unitPrice", created_at AS "createdAt"
       FROM commerce_reseller_deliveries WHERE organization_id = $1 ORDER BY created_at DESC, id`, [organizationId],
    ),
    queryAll<SqlRow & ResellerEvent>(
      `SELECT id, reseller_id AS "resellerId", total AS amount, created_at AS "createdAt",
              'settlement' AS kind, consignment_period AS period
       FROM commerce_sales WHERE organization_id = $1 AND reseller_id IS NOT NULL
       UNION ALL
       SELECT id, reseller_id, amount, created_at, method, NULL
       FROM commerce_reseller_receipts WHERE organization_id = $1
       ORDER BY "createdAt" DESC, kind DESC`, [organizationId],
    ),
  ]);
  return {
    resellers: resellers.map(({ id, name, billed, received }) => ({ id, name, billed: Number(billed), received: Number(received) })),
    deliveries,
    events,
  };
}

async function stockMovement(actor: CommerceActor, request: Request, productId: string, delta: number, note: string, now: string, client: SqlExecutor) {
  const product = await queryOne<SqlRow & { name: string; cost: number }>(
    `UPDATE commerce_products SET stock = stock + $3, updated_at = $4
     WHERE organization_id = $1 AND id = $2 AND ($3::int > 0 OR (active AND stock >= -$3))
     RETURNING name, cost`, [actor.organizationId, productId, delta, now], client,
  );
  if (!product) throw new ConsignmentError("Produto indisponível ou stock insuficiente.");
  await execute(
    `INSERT INTO commerce_stock_movements
     (id, organization_id, product_id, movement_type, quantity_delta, source_id, actor_user_id, device_id, created_at, note)
     VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, $7, $8, $9)`,
    [`${request.requestId}:${productId}`, actor.organizationId, productId, delta, request.requestId, actor.id, request.deviceId, now, note], client,
  );
  return product;
}

async function recordPayment(actor: CommerceActor, request: Request & { resellerId: string }, payment: Payment, saleId: string | null, now: string, client: SqlExecutor) {
  const balance = await queryOne<SqlRow & { pending: string }>(
    `SELECT COALESCE((SELECT SUM(total) FROM commerce_sales WHERE organization_id = $1 AND reseller_id = $2), 0)
          - COALESCE((SELECT SUM(amount) FROM commerce_reseller_receipts WHERE organization_id = $1 AND reseller_id = $2), 0) AS pending`,
    [actor.organizationId, request.resellerId], client,
  );
  if (payment.amount > Number(balance?.pending ?? 0)) throw new ConsignmentError("O valor recebido ultrapassa o saldo a receber.");
  const sessionId = payment.method === "cash" ? payment.cashSessionId : null;
  if (sessionId) {
    const cash = await queryOne<SqlRow>(
      `SELECT id FROM commerce_cash_sessions
       WHERE id = $1 AND organization_id = $2 AND device_id = $3 AND opened_by = $4 AND status = 'open' FOR UPDATE`,
      [sessionId, actor.organizationId, request.deviceId, actor.id], client,
    );
    if (!cash) throw new ConsignmentError("Abra e sincronize o seu caixa antes de registar o pagamento em dinheiro.");
  }
  await execute(
    `INSERT INTO commerce_reseller_receipts
     (id, organization_id, reseller_id, actor_user_id, sale_id, cash_session_id, amount, method, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [request.requestId, actor.organizationId, request.resellerId, actor.id, saleId, sessionId, payment.amount, payment.method, now], client,
  );
}

export async function writeConsignment(actor: CommerceActor, request: Request) {
  return inTransaction(async (client) => {
    const organizationId = actor.organizationId;
    const store = await queryOne<SqlRow>(
      "SELECT id FROM organizations WHERE id = $1 AND status = 'active' AND 'commerce' = ANY(enabled_modules) FOR UPDATE",
      [organizationId], client,
    );
    const owner = store && await queryOne<SqlRow>(
      'SELECT id FROM "user" WHERE id = $1 AND organization_id = $2 AND is_store_owner AND store_role = \'admin\' AND banned IS NOT TRUE FOR SHARE',
      [actor.id, organizationId], client,
    );
    if (!owner) throw new ConsignmentError("O acesso à gestão de revendedores foi removido.");
    const claimed = await execute(
      "INSERT INTO commerce_consignment_requests (organization_id, id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [organizationId, request.requestId], client,
    );
    if (!claimed.rowCount) return;

    const now = new Date().toISOString();
    if (request.kind === "reseller") {
      const inserted = await execute(
        "INSERT INTO commerce_resellers (id, organization_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [request.requestId, organizationId, request.name], client,
      );
      if (!inserted.rowCount) throw new ConsignmentError("Já existe um revendedor com esse nome.");
      return;
    }
    if (request.kind === "stock") {
      await stockMovement(actor, request, request.productId, request.quantity, "Entrada de produção", now, client);
      return;
    }
    const reseller = await queryOne<SqlRow & { name: string }>(
      "SELECT name FROM commerce_resellers WHERE organization_id = $1 AND id = $2", [organizationId, request.resellerId], client,
    );
    if (!reseller) throw new ConsignmentError("Revendedor não encontrado nesta loja.");
    if (request.kind === "payment") {
      await recordPayment(actor, request, request.payment, null, now, client);
      return;
    }
    if (request.kind === "delivery") {
      if (new Set(request.lines.map((line) => line.productId)).size !== request.lines.length) {
        throw new ConsignmentError("Inclua cada produto apenas uma vez na entrega.");
      }
      for (const line of request.lines) {
        const product = await stockMovement(actor, request, line.productId, -line.quantity, `Entrega a ${reseller.name}`, now, client);
        await execute(
          `INSERT INTO commerce_reseller_deliveries
           (id, organization_id, reseller_id, product_id, product_name, delivered, unit_price, unit_cost, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [`${request.requestId}:${line.productId}`, organizationId, request.resellerId, line.productId, product.name, line.quantity, line.unitPrice, product.cost, now], client,
        );
      }
      return;
    }

    const quantities = new Map(request.lines.map((line) => [line.deliveryId, line.quantity]));
    if (quantities.size !== request.lines.length) throw new ConsignmentError("Inclua cada linha de entrega apenas uma vez.");
    const deliveries = await queryAll<SqlRow & {
      id: string; product_id: string; product_name: string; delivered: number; sold: number; returned: number; unit_price: number; unit_cost: number;
    }>(
      "SELECT * FROM commerce_reseller_deliveries WHERE organization_id = $1 AND reseller_id = $2 AND id = ANY($3::text[]) ORDER BY id FOR UPDATE",
      [organizationId, request.resellerId, [...quantities.keys()]], client,
    );
    if (deliveries.length !== quantities.size) throw new ConsignmentError("Uma entrega não pertence a este revendedor.");
    const lines = deliveries.map((line) => {
      const count = quantities.get(line.id)!;
      if (count > line.delivered - line.sold - line.returned) throw new ConsignmentError("A quantidade ultrapassa as unidades com o revendedor.");
      return { ...line, count };
    });

    if (request.kind === "return") {
      const stock = new Map<string, number>();
      for (const line of lines) {
        await execute("UPDATE commerce_reseller_deliveries SET returned = returned + $2 WHERE id = $1", [line.id, line.count], client);
        stock.set(line.product_id, (stock.get(line.product_id) ?? 0) + line.count);
      }
      for (const [productId, count] of stock) {
        await stockMovement(actor, request, productId, count, `Devolução de ${reseller.name}`, now, client);
      }
      return;
    }

    const total = lines.reduce((sum, line) => sum + line.count * line.unit_price, 0);
    if (total > 2_000_000_000) throw new ConsignmentError("O acerto excede o valor máximo permitido.");
    await execute(
      `INSERT INTO commerce_sales
       (id, organization_id, actor_user_id, device_id, created_at, total, received, change_amount, reseller_id, consignment_period)
       VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8)`,
      [request.requestId, organizationId, actor.id, request.deviceId, now, total, request.resellerId, request.period], client,
    );
    for (const [position, line] of lines.entries()) {
      await execute("UPDATE commerce_reseller_deliveries SET sold = sold + $2 WHERE id = $1", [line.id, line.count], client);
      await execute(
        `INSERT INTO commerce_sale_lines (id, sale_id, product_id, position, name, quantity, unit_price, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [`${request.requestId}:${position}`, request.requestId, line.product_id, position, line.product_name, line.count, line.unit_price, line.unit_cost], client,
      );
    }
    if (request.payment) await recordPayment(actor, request, request.payment, request.requestId, now, client);
  });
}
