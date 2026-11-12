import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CashSession, Expense, Product, Sale, SaleLine } from "../model";
import { execute, inTransaction, queryAll, queryOne, type SqlExecutor, type SqlRow } from "./db";
import type { CommerceActor } from "./actor";
import { hasStorePermission, type StorePermission } from "../store-permissions";
import { cloudinaryConfig, productImageId, productImageUrl } from "./product-images";

const productSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(80),
  stock: z.number().int().min(0).max(1_000_000),
  price: z.number().int().min(0).max(2_000_000_000),
  cost: z.number().int().min(0).max(2_000_000_000),
  emoji: z.string().max(16),
  active: z.boolean().optional(),
  imageUrl: z.url().max(500).optional(),
});

const saleLineSchema = z.object({
  productId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(100_000),
  unitPrice: z.number().int().min(0).max(2_000_000_000),
  unitCost: z.number().int().min(0).max(2_000_000_000),
});

const saleSchema = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  cashSessionId: z.string().uuid().optional(),
  items: z.array(saleLineSchema).min(1).max(100),
  total: z.number().int().min(0).max(2_000_000_000),
  received: z.number().int().min(0).max(2_000_000_000),
  change: z.number().int().min(0).max(2_000_000_000),
}).superRefine((sale, context) => {
  const productIds = sale.items.map((line) => line.productId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: "custom", message: "Cada produto deve aparecer uma vez na venda.", path: ["items"] });
  }
  const total = sale.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (!Number.isSafeInteger(total) || total > 2_000_000_000) {
    context.addIssue({ code: "custom", message: "O total da venda excede o limite permitido.", path: ["total"] });
  }
});

const expenseSchema = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  cashSessionId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(80),
  amount: z.number().int().min(1).max(2_000_000_000),
});

const cashSessionOpenSchema = z.object({
  id: z.string().uuid(),
  openingAmount: z.number().int().min(0).max(2_000_000_000),
});

const cashSessionCloseSchema = z.object({
  id: z.string().uuid(),
  countedAmount: z.number().int().min(0).max(2_000_000_000),
});

export const syncOperationSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    type: z.literal("product.save"),
    createdAt: z.iso.datetime(),
    actorId: z.string().min(1).max(100),
    deviceId: z.string().min(1).max(100),
    payload: productSchema,
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("sale.create"),
    createdAt: z.iso.datetime(),
    actorId: z.string().min(1).max(100),
    deviceId: z.string().min(1).max(100),
    payload: saleSchema,
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("expense.create"),
    createdAt: z.iso.datetime(),
    actorId: z.string().min(1).max(100),
    deviceId: z.string().min(1).max(100),
    payload: expenseSchema,
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("cash-session.open"),
    createdAt: z.iso.datetime(),
    actorId: z.string().min(1).max(100),
    deviceId: z.string().min(1).max(100),
    payload: cashSessionOpenSchema,
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("cash-session.close"),
    createdAt: z.iso.datetime(),
    actorId: z.string().min(1).max(100),
    deviceId: z.string().min(1).max(100),
    payload: cashSessionCloseSchema,
  }),
]);

export type SyncOperation = z.infer<typeof syncOperationSchema>;
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

type ProductRow = SqlRow & {
  id: string; name: string; category: string; sku: string; stock: number;
  price: number; cost: number; emoji: string; image_url: string | null; active: boolean;
};
type SaleRow = SqlRow & {
  id: string; created_at: string; cash_session_id: string | null; total: number; received: number; change_amount: number;
};
type SaleLineRow = SqlRow & {
  sale_id: string; product_id: string; name: string; quantity: number;
  unit_price: number; unit_cost: number; position: number;
};
type ExpenseRow = SqlRow & {
  id: string; created_at: string; cash_session_id: string | null; description: string; category: string; amount: number;
};
type CashSessionRow = SqlRow & {
  reseller_receipts: CashSession["resellerReceipts"];
  id: string; device_id: string; opened_by: string; opened_by_name: string | null; opened_at: string;
  opening_amount: number | string; status: "open" | "closed"; closed_by: string | null; closed_by_name: string | null;
  closed_at: string | null; expected_amount: number | string | null; counted_amount: number | string | null; difference_amount: number | string | null;
};
type ConflictRow = SqlRow & {
  id: string; sale_id: string; product_id: string; product_name: string; device_id: string;
  quantity_sold: number; stock_before: number; stock_after: number; created_at: string;
};

function mapProduct(row: ProductRow): Product {
  return { id: row.id, name: row.name, category: row.category, sku: row.sku, stock: row.stock, price: row.price, cost: row.cost, emoji: row.emoji, active: row.active, imageUrl: row.image_url ?? undefined };
}

function mapSaleLine(row: SaleLineRow): SaleLine {
  return { productId: row.product_id, name: row.name, quantity: row.quantity, unitPrice: row.unit_price, unitCost: row.unit_cost };
}

function mapConflict(row: ConflictRow): StockConflict {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productName: row.product_name,
    deviceId: row.device_id,
    quantitySold: row.quantity_sold,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    createdAt: row.created_at,
  };
}

function mapCashSession(row: CashSessionRow): CashSession {
  return {
    resellerReceipts: row.reseller_receipts,
    id: row.id,
    deviceId: row.device_id,
    openedBy: row.opened_by,
    openedByName: row.opened_by_name ?? undefined,
    openedAt: row.opened_at,
    openingAmount: Number(row.opening_amount),
    status: row.status,
    closedBy: row.closed_by ?? undefined,
    closedByName: row.closed_by_name ?? undefined,
    closedAt: row.closed_at ?? undefined,
    expectedAmount: row.expected_amount === null ? undefined : Number(row.expected_amount),
    countedAmount: row.counted_amount === null ? undefined : Number(row.counted_amount),
    differenceAmount: row.difference_amount === null ? undefined : Number(row.difference_amount),
    syncState: "synced",
  };
}

export async function readCommerceSnapshot(organizationId: string, employeeId: string | null = null) {
  return inTransaction(async (client) => {
    const productRows = await queryAll<ProductRow>(
      "SELECT id, name, category, sku, stock, price, cost, emoji, image_url, active FROM commerce_products WHERE organization_id = $1 ORDER BY lower(name), name",
      [organizationId], client,
    );
    const sales = await queryAll<SaleRow>(
      "SELECT id, created_at, cash_session_id, total, received, change_amount FROM commerce_sales WHERE organization_id = $1 AND ($2::text IS NULL OR actor_user_id = $2) ORDER BY created_at DESC",
      [organizationId, employeeId], client,
    );
    const saleLines = await queryAll<SaleLineRow>(
      "SELECT l.sale_id, l.product_id, l.name, l.quantity, l.unit_price, l.unit_cost, l.position FROM commerce_sale_lines l INNER JOIN commerce_sales s ON s.id = l.sale_id WHERE s.organization_id = $1 AND ($2::text IS NULL OR s.actor_user_id = $2) ORDER BY l.sale_id, l.position",
      [organizationId, employeeId], client,
    );
    const expenseRows = await queryAll<ExpenseRow>(
      "SELECT id, created_at, cash_session_id, description, category, amount FROM commerce_expenses WHERE organization_id = $1 AND ($2::text IS NULL OR actor_user_id = $2) ORDER BY created_at DESC",
      [organizationId, employeeId], client,
    );
    const cashSessionRows = await queryAll<CashSessionRow>(
      `SELECT s.id, s.device_id, s.opened_by, opener.name AS opened_by_name, s.opened_at,
              s.opening_amount, s.status, s.closed_by, closer.name AS closed_by_name,
              s.closed_at, s.expected_amount, s.counted_amount, s.difference_amount,
              COALESCE((SELECT json_agg(json_build_object('id', p.id, 'name', r.name, 'amount', p.amount, 'createdAt', p.created_at))
                FROM commerce_reseller_receipts p
                JOIN commerce_resellers r ON r.id = p.reseller_id AND r.organization_id = p.organization_id
                WHERE p.cash_session_id = s.id AND $2::text IS NULL), '[]'::json) AS reseller_receipts
       FROM commerce_cash_sessions s
       LEFT JOIN "user" opener ON opener.id = s.opened_by
       LEFT JOIN "user" closer ON closer.id = s.closed_by
       WHERE s.organization_id = $1 AND ($2::text IS NULL OR s.opened_by = $2)
       ORDER BY s.opened_at DESC`,
      [organizationId, employeeId], client,
    );
    const conflictRows = employeeId ? [] : await queryAll<ConflictRow>(
      "SELECT id, sale_id, product_id, product_name, device_id, quantity_sold, stock_before, stock_after, created_at FROM stock_conflicts WHERE organization_id = $1 AND resolved_at IS NULL ORDER BY created_at DESC",
      [organizationId], client,
    );

    const linesBySale = new Map<string, SaleLine[]>();
    for (const row of saleLines) {
      const lines = linesBySale.get(row.sale_id) ?? [];
      lines.push(mapSaleLine(row));
      linesBySale.set(row.sale_id, lines);
    }

    const mappedSales: Sale[] = sales.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      cashSessionId: row.cash_session_id ?? undefined,
      total: row.total,
      received: row.received,
      change: row.change_amount,
      syncState: "synced",
      items: linesBySale.get(row.id) ?? [],
    }));

    const expenses: Expense[] = expenseRows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      cashSessionId: row.cash_session_id ?? undefined,
      description: row.description,
      category: row.category,
      amount: row.amount,
      syncState: "synced",
    }));

    return {
      products: productRows.map(mapProduct),
      sales: mappedSales,
      expenses,
      cashSessions: cashSessionRows.map(mapCashSession),
      stockConflicts: conflictRows.map(mapConflict),
    };
  });
}

function assertSaleAmounts(sale: Pick<Sale, "items" | "total" | "received" | "change">) {
  const totalFromLines = sale.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (totalFromLines !== sale.total || sale.received < sale.total || sale.received - sale.total !== sale.change) {
    throw new Error("Valores da venda não correspondem aos artigos e ao troco.");
  }
}

type CashSessionWriteRow = SqlRow & {
  id: string;
  device_id: string;
  opening_amount: number | string;
  status: "open" | "closed";
  counted_amount: number | string | null;
};

async function lockCashSessionForOperation(sessionId: string, actor: CommerceActor, deviceId: string, client: SqlExecutor) {
  const session = await queryOne<CashSessionWriteRow>(
    "SELECT id, device_id, opening_amount, status, counted_amount FROM commerce_cash_sessions WHERE id = $1 AND organization_id = $2 AND ($3::text IS NULL OR opened_by = $3) FOR UPDATE",
    [sessionId, actor.organizationId, actor.role === "collaborator" ? actor.id : null], client,
  );
  if (!session) throw new Error("A sessão de caixa da operação não existe nesta loja.");
  if (session.device_id !== deviceId) throw new Error("A sessão de caixa pertence a outro dispositivo.");
  return session;
}

async function recalculateClosedCashSession(session: CashSessionWriteRow, client: SqlExecutor) {
  if (session.status !== "closed" || session.counted_amount === null) return;
  const totals = await queryOne<SqlRow & { sales_total: number | string; expenses_total: number | string }>(
    `SELECT
       COALESCE((SELECT SUM(total) FROM commerce_sales WHERE cash_session_id = $1), 0)
       + COALESCE((SELECT SUM(amount) FROM commerce_reseller_receipts WHERE cash_session_id = $1), 0) AS sales_total,
       COALESCE((SELECT SUM(amount) FROM commerce_expenses WHERE cash_session_id = $1), 0) AS expenses_total`,
    [session.id], client,
  );
  const expectedAmount = Number(session.opening_amount) + Number(totals?.sales_total ?? 0) - Number(totals?.expenses_total ?? 0);
  const differenceAmount = Number(session.counted_amount) - expectedAmount;
  if (!Number.isSafeInteger(expectedAmount) || !Number.isSafeInteger(differenceAmount)) {
    throw new Error("Os valores desta sessão excedem o limite numérico suportado.");
  }
  await execute(
    "UPDATE commerce_cash_sessions SET expected_amount = $1, difference_amount = $2 WHERE id = $3",
    [expectedAmount, differenceAmount, session.id], client,
  );
}

async function ensureActorMembership(actorId: string, actor: CommerceActor, client: SqlExecutor) {
  if (actorId !== actor.id) throw new Error("Entre na conta que registou estas operações para sincronizar.");
  const member = await queryOne<SqlRow & { store_permissions: StorePermission[] }>(
    `SELECT u.store_permissions FROM "user" u JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = $1 AND u.organization_id = $2 AND u.store_role = $3 AND u.banned IS NOT TRUE
     AND o.status = 'active' AND 'commerce' = ANY(o.enabled_modules) FOR SHARE OF u, o`,
    [actorId, actor.organizationId, actor.role], client,
  );
  if (!member) throw new Error("O utilizador de origem já não tem acesso a esta loja.");
  return member.store_permissions;
}

type ProcessedResult = { conflicts?: StockConflict[] };
type SyncResult =
  | { id: string; status: "duplicate" | "accepted" | "conflict"; conflicts: StockConflict[] }
  | { id: string; status: "rejected"; error: string; retryable: boolean };

async function getProcessedResult(id: string, actor: CommerceActor, client?: SqlExecutor) {
  const previous = await queryOne<SqlRow & { result_json: string }>(
    "SELECT result_json FROM processed_sync_operations WHERE id = $1 AND organization_id = $2 AND actor_user_id = $3",
    [id, actor.organizationId, actor.id], client,
  );
  if (!previous) return null;
  return JSON.parse(previous.result_json) as ProcessedResult;
}

async function applyOperation(operation: SyncOperation, actor: CommerceActor): Promise<SyncResult> {
  try {
    const previous = await getProcessedResult(operation.id, actor);
    if (previous) return { id: operation.id, status: "duplicate", conflicts: previous.conflicts ?? [] };

    const result = await inTransaction(async (client) => {
      const claim = await execute(
        `INSERT INTO processed_sync_operations
          (id, organization_id, actor_user_id, device_id, operation_type, entity_id, created_at, received_at, result_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}')
         ON CONFLICT (organization_id, id) DO NOTHING
         RETURNING id`,
        [operation.id, actor.organizationId, operation.actorId, operation.deviceId, operation.type,
          operation.payload.id, operation.createdAt, new Date().toISOString()], client,
      );

      if (!claim.rowCount) {
        const duplicate = await getProcessedResult(operation.id, actor, client);
        if (!duplicate) throw new Error("O identificador da operação já foi utilizado noutra loja.");
        return { conflicts: duplicate.conflicts ?? [], duplicate: true };
      }

      const permissions = await ensureActorMembership(operation.actorId, actor, client);
      const conflicts: StockConflict[] = [];

      if (operation.type === "product.save") {
        if (!hasStorePermission({ role: actor.role, permissions }, "products:write")) {
          throw new Error("A sua conta não tem permissão para alterar produtos.");
        }
        const product = operation.payload;
        const canManageCosts = actor.role === "admin";
        if (product.imageUrl) {
          const config = cloudinaryConfig();
          if (!config || !z.uuid().safeParse(product.id).success || product.imageUrl !== productImageUrl(config.cloud, productImageId(actor.organizationId, product.id))) {
            throw new Error("A foto não pertence a este produto.");
          }
        }
        const skuOwner = await queryOne<SqlRow>(
          "SELECT id FROM commerce_products WHERE organization_id = $1 AND lower(sku) = lower($2) AND id <> $3",
          [actor.organizationId, product.sku, product.id], client,
        );
        if (skuOwner) throw new Error("Já existe um produto com esse código nesta loja.");

        const existing = await queryOne<SqlRow>(
          "SELECT id FROM commerce_products WHERE id = $1 AND organization_id = $2",
          [product.id, actor.organizationId], client,
        );
        if (existing) {
          await execute(
            "UPDATE commerce_products SET name = $1, category = $2, sku = $3, price = $4, cost = COALESCE($5, cost), emoji = $6, updated_at = $7, image_url = COALESCE($10, image_url), active = COALESCE($11, active) WHERE id = $8 AND organization_id = $9",
            [product.name, product.category, product.sku, product.price, canManageCosts ? product.cost : null, product.emoji, operation.createdAt, product.id, actor.organizationId, product.imageUrl ?? null, product.active ?? null], client,
          );
        } else {
          await execute(
            "INSERT INTO commerce_products (id, organization_id, name, category, sku, stock, price, cost, emoji, updated_at, image_url, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            [product.id, actor.organizationId, product.name, product.category, product.sku, product.stock, product.price, canManageCosts ? product.cost : 0, product.emoji, operation.createdAt, product.imageUrl ?? null, product.active ?? true], client,
          );
          if (product.stock > 0) {
            await execute(
              "INSERT INTO commerce_stock_movements (id, organization_id, product_id, movement_type, quantity_delta, source_id, actor_user_id, device_id, created_at, note) VALUES ($1, $2, $3, 'opening', $4, $5, $6, $7, $8, $9)",
              [`${operation.id}:opening`, actor.organizationId, product.id, product.stock, operation.id, actor.id, operation.deviceId, operation.createdAt, "Stock inicial do produto"], client,
            );
          }
        }
      } else if (operation.type === "sale.create") {
        const sale = operation.payload;
        assertSaleAmounts(sale);
        const cashSession = sale.cashSessionId
          ? await lockCashSessionForOperation(sale.cashSessionId, actor, operation.deviceId, client)
          : null;
        await execute(
          "INSERT INTO commerce_sales (id, organization_id, actor_user_id, device_id, created_at, cash_session_id, total, received, change_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [sale.id, actor.organizationId, operation.actorId, operation.deviceId, sale.createdAt, sale.cashSessionId ?? null, sale.total, sale.received, sale.change], client,
        );

        const lockedProducts = await queryAll<SqlRow & { id: string; stock: number; name: string; cost: number }>(
          "SELECT id, stock, name, cost FROM commerce_products WHERE organization_id = $1 AND id = ANY($2::text[]) ORDER BY id FOR UPDATE",
          [actor.organizationId, sale.items.map((line) => line.productId)], client,
        );
        const productsById = new Map(lockedProducts.map((product) => [product.id, product]));

        for (const [index, line] of sale.items.entries()) {
          const product = productsById.get(line.productId);
          if (!product) throw new Error("Um produto da venda já não existe nesta loja.");
          const stockBefore = product.stock;
          const stockAfter = stockBefore - line.quantity;

          await execute(
            "INSERT INTO commerce_sale_lines (id, sale_id, product_id, position, name, quantity, unit_price, unit_cost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [`${sale.id}:${index}`, sale.id, line.productId, index, line.name, line.quantity, line.unitPrice, product.cost], client,
          );
          await execute(
            "UPDATE commerce_products SET stock = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4",
            [stockAfter, sale.createdAt, line.productId, actor.organizationId], client,
          );
          await execute(
            "INSERT INTO commerce_stock_movements (id, organization_id, product_id, movement_type, quantity_delta, source_id, actor_user_id, device_id, created_at) VALUES ($1, $2, $3, 'sale', $4, $5, $6, $7, $8)",
            [`${sale.id}:${line.productId}`, actor.organizationId, line.productId, -line.quantity, sale.id, actor.id, operation.deviceId, sale.createdAt], client,
          );

          if (stockAfter < 0) {
            const conflict: StockConflict = {
              id: `${sale.id}:${line.productId}`,
              saleId: sale.id,
              productId: line.productId,
              productName: product.name,
              deviceId: operation.deviceId,
              quantitySold: line.quantity,
              stockBefore,
              stockAfter,
              createdAt: sale.createdAt,
            };
            await execute(
              "INSERT INTO stock_conflicts (id, organization_id, sale_id, product_id, product_name, device_id, quantity_sold, stock_before, stock_after, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
              [conflict.id, actor.organizationId, conflict.saleId, conflict.productId, conflict.productName, conflict.deviceId, conflict.quantitySold, conflict.stockBefore, conflict.stockAfter, conflict.createdAt], client,
            );
            conflicts.push(conflict);
          }
        }
        if (cashSession) await recalculateClosedCashSession(cashSession, client);
      } else if (operation.type === "expense.create") {
        const expense = operation.payload;
        const cashSession = expense.cashSessionId
          ? await lockCashSessionForOperation(expense.cashSessionId, actor, operation.deviceId, client)
          : null;
        await execute(
          "INSERT INTO commerce_expenses (id, organization_id, actor_user_id, device_id, created_at, cash_session_id, description, category, amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [expense.id, actor.organizationId, operation.actorId, operation.deviceId, expense.createdAt, expense.cashSessionId ?? null, expense.description, expense.category, expense.amount], client,
        );
        if (cashSession) await recalculateClosedCashSession(cashSession, client);
      } else if (operation.type === "cash-session.open") {
        await execute(
          "INSERT INTO commerce_cash_sessions (id, organization_id, device_id, opened_by, opened_at, opening_amount, status) VALUES ($1, $2, $3, $4, $5, $6, 'open')",
          [operation.payload.id, actor.organizationId, operation.deviceId, operation.actorId, operation.createdAt, operation.payload.openingAmount], client,
        );
      } else {
        const session = await lockCashSessionForOperation(operation.payload.id, actor, operation.deviceId, client);
        if (session.status !== "open") throw new Error("Esta sessão de caixa já está fechada.");
        const totals = await queryOne<SqlRow & { sales_total: number | string; expenses_total: number | string }>(
          `SELECT
             COALESCE((SELECT SUM(total) FROM commerce_sales WHERE cash_session_id = $1), 0)
             + COALESCE((SELECT SUM(amount) FROM commerce_reseller_receipts WHERE cash_session_id = $1), 0) AS sales_total,
             COALESCE((SELECT SUM(amount) FROM commerce_expenses WHERE cash_session_id = $1), 0) AS expenses_total`,
          [session.id], client,
        );
        const expectedAmount = Number(session.opening_amount) + Number(totals?.sales_total ?? 0) - Number(totals?.expenses_total ?? 0);
        const differenceAmount = operation.payload.countedAmount - expectedAmount;
        if (!Number.isSafeInteger(expectedAmount) || !Number.isSafeInteger(differenceAmount)) {
          throw new Error("Os valores desta sessão excedem o limite numérico suportado.");
        }
        await execute(
          `UPDATE commerce_cash_sessions
           SET status = 'closed', closed_by = $1, closed_at = $2, expected_amount = $3, counted_amount = $4, difference_amount = $5
           WHERE id = $6 AND organization_id = $7`,
          [operation.actorId, operation.createdAt, expectedAmount, operation.payload.countedAmount, differenceAmount, session.id, actor.organizationId], client,
        );
      }

      await execute(
        "UPDATE processed_sync_operations SET result_json = $1 WHERE id = $2 AND organization_id = $3",
        [JSON.stringify({ conflicts }), operation.id, actor.organizationId], client,
      );
      return { conflicts, duplicate: false };
    });

    if (result.duplicate) return { id: operation.id, status: "duplicate", conflicts: result.conflicts };
    return { id: operation.id, status: result.conflicts.length ? "conflict" : "accepted", conflicts: result.conflicts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível guardar a operação.";
    const databaseError = error as { code?: string; constraint?: string };
    const isTemporary = ["40001", "40P01", "55P03", "53300", "57P01"].includes(databaseError.code ?? "")
      || /temporar|timeout|connection/i.test(message);
    const safeMessages = [
      "O utilizador de origem já não tem acesso a esta loja.",
      "Entre na conta que registou estas operações para sincronizar.",
      "A sua conta não tem permissão para alterar produtos.",
      "Já existe um produto com esse código nesta loja.",
      "Valores da venda não correspondem aos artigos e ao troco.",
      "Um produto da venda já não existe nesta loja.",
      "A sessão de caixa da operação não existe nesta loja.",
      "A sessão de caixa pertence a outro dispositivo.",
      "Esta sessão de caixa já está fechada.",
      "Os valores desta sessão excedem o limite numérico suportado.",
    ];
    const safeMessage = safeMessages.includes(message)
      ? message
      : databaseError.constraint === "commerce_products_organization_sku_ci_unique"
        ? "Já existe um produto com esse código nesta loja."
        : databaseError.constraint === "commerce_cash_sessions_one_open_per_device"
          ? "Já existe uma sessão de caixa aberta neste dispositivo."
        : "O servidor não conseguiu aceitar esta operação. Reveja os dados ou tente novamente.";
    return { id: operation.id, status: "rejected", error: safeMessage, retryable: isTemporary };
  }
}

export async function processSyncBatch(operations: SyncOperation[], actor: CommerceActor) {
  const results: SyncResult[] = [];
  for (const operation of operations) {
    const result = await applyOperation(operation, actor);
    results.push(result);
    if (result.status === "rejected") break;
  }
  return results;
}

export async function reconcileStockConflict(conflictId: string, countedStock: number, actor: CommerceActor) {
  if (actor.role !== "admin") throw new Error("Só um administrador pode reconciliar o stock.");

  return inTransaction(async (client) => {
    const conflict = await queryOne<SqlRow & { product_id: string; product_name: string; resolved_at: string | null }>(
      "SELECT product_id, product_name, resolved_at FROM stock_conflicts WHERE id = $1 AND organization_id = $2 FOR UPDATE",
      [conflictId, actor.organizationId], client,
    );
    if (!conflict) throw new Error("A divergência de stock não foi encontrada.");
    if (conflict.resolved_at) throw new Error("Esta divergência já foi reconciliada.");

    const product = await queryOne<SqlRow & { stock: number }>(
      "SELECT stock FROM commerce_products WHERE id = $1 AND organization_id = $2 FOR UPDATE",
      [conflict.product_id, actor.organizationId], client,
    );
    if (!product) throw new Error("O produto desta divergência já não existe.");

    const now = new Date().toISOString();
    const adjustment = countedStock - product.stock;
    await execute(
      "UPDATE commerce_products SET stock = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4",
      [countedStock, now, conflict.product_id, actor.organizationId], client,
    );
    await execute(
      "UPDATE stock_conflicts SET resolved_at = $1 WHERE id = $2 AND organization_id = $3",
      [now, conflictId, actor.organizationId], client,
    );
    if (adjustment !== 0) {
      await execute(
        "INSERT INTO commerce_stock_movements (id, organization_id, product_id, movement_type, quantity_delta, source_id, actor_user_id, device_id, created_at, note) VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, $7, $8, $9)",
        [randomUUID(), actor.organizationId, conflict.product_id, adjustment, conflictId, actor.id, "admin-reconciliation", now,
          `Contagem física definida para ${countedStock} unidades após divergência de stock.`], client,
      );
    }
    return { conflictId, productId: conflict.product_id, productName: conflict.product_name, countedStock, adjustment, resolvedAt: now };
  });
}
