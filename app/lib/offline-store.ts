import type {
  CashSession,
  CommerceData,
  CommerceProfile,
  Expense,
  OutboxOperation,
  Product,
  Sale,
  StockConflict,
} from "./model";
import { isStoreModuleId } from "./store-modules";
import type { StoreModuleId } from "./store-modules";

const LEGACY_DATABASE_NAME = "konta-commerce";
const DATABASE_NAME_PREFIX = "konta-commerce-tenant-v1-";
const DATABASE_VERSION = 4;
const STORE_NAMES = ["products", "sales", "expenses", "cash-sessions", "outbox", "meta"] as const;
const OFFLINE_SESSION_KEY = "offline-session";
const LEGACY_SESSION_CONSUMED_KEY = "legacy-session-consumed";
const SESSION_DATABASE_NAME = "konta-session";
const SESSION_DATABASE_VERSION = 1;
const LEGACY_MIGRATION_KEY = "legacy-default-data-migrated";
const DEVICE_ID_KEY = "device-id";
const OPERATION_SEQUENCE_KEY = "operation-sequence";

let activeOrganizationId: string | null = null;
const databasePromises = new Map<string, Promise<IDBDatabase>>();
let sessionDatabasePromise: Promise<IDBDatabase> | undefined;

function requiredOrganizationId(organizationId = activeOrganizationId) {
  if (!organizationId) throw new Error("A loja não está seleccionada para o armazenamento offline.");
  return organizationId;
}

function openDatabase(organizationId?: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não suporta armazenamento offline."));
  }

  const scopeId = requiredOrganizationId(organizationId);
  const existingPromise = databasePromises.get(scopeId);
  if (existingPromise) return existingPromise;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(`${DATABASE_NAME_PREFIX}${encodeURIComponent(scopeId)}`, DATABASE_VERSION);
    let wasBlocked = false;

    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      }

      const transaction = request.transaction;
      if (!transaction) return;
      const outbox = transaction.objectStore("outbox");
      const pendingRequest = outbox.getAll();
      pendingRequest.onsuccess = () => {
        const pending = pendingRequest.result as OutboxOperation[];
        const existingSequences = pending
          .map((entry) => entry.sequence)
          .filter((sequence): sequence is number => typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence > 0);
        let sequence = existingSequences.reduce((maximum, value) => Math.max(maximum, value), 0);
        const missingSequence = pending
          .filter((entry) => typeof entry.sequence !== "number" || !Number.isSafeInteger(entry.sequence) || entry.sequence < 1)
          .sort((left, right) => {
            const leftTime = typeof left.createdAt === "string" ? left.createdAt : "";
            const rightTime = typeof right.createdAt === "string" ? right.createdAt : "";
            return leftTime.localeCompare(rightTime);
          });
        for (const entry of missingSequence) outbox.put({ ...entry, sequence: ++sequence });
        transaction.objectStore("meta").put({ id: OPERATION_SEQUENCE_KEY, value: sequence });
      };
    };

    request.onsuccess = () => {
      if (wasBlocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromises.delete(scopeId);
      reject(request.error ?? new Error("Não foi possível abrir o armazenamento local."));
    };
    request.onblocked = () => {
      wasBlocked = true;
      databasePromises.delete(scopeId);
      reject(new Error("Feche outras janelas da Kontá para atualizar o armazenamento."));
    };
  });

  databasePromises.set(scopeId, promise);
  return promise;
}

function openSessionDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não suporta armazenamento offline."));
  }
  if (sessionDatabasePromise) return sessionDatabasePromise;
  sessionDatabasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(SESSION_DATABASE_NAME, SESSION_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("session")) database.createObjectStore("session", { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      sessionDatabasePromise = undefined;
      reject(request.error ?? new Error("Não foi possível abrir o perfil offline."));
    };
    request.onblocked = () => {
      sessionDatabasePromise = undefined;
      reject(new Error("Feche outras janelas da Kontá para actualizar o perfil offline."));
    };
  });
  return sessionDatabasePromise;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao aceder aos dados locais."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("A gravação local falhou."));
    transaction.onabort = () => reject(transaction.error ?? new Error("A gravação local foi cancelada."));
  });
}

async function readAll<T>(storeName: (typeof STORE_NAMES)[number], organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const values = await requestResult(transaction.objectStore(storeName).getAll());
  await done;
  return values as T[];
}

function readStore<T>(database: IDBDatabase, storeName: string) {
  return new Promise<T[]>((resolve, reject) => {
    if (!database.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível ler os dados locais antigos."));
  });
}

async function openLegacyDatabaseIfExists() {
  if (typeof window.indexedDB.databases === "function") {
    const databases = await window.indexedDB.databases();
    if (!databases.some((database) => database.name === LEGACY_DATABASE_NAME)) return null;
  }

  return new Promise<IDBDatabase | null>((resolve, reject) => {
    let wasCreated = false;
    const request = window.indexedDB.open(LEGACY_DATABASE_NAME);
    request.onupgradeneeded = () => { wasCreated = true; };
    request.onsuccess = () => {
      const database = request.result;
      if (!wasCreated) {
        resolve(database);
        return;
      }
      database.close();
      const deletion = window.indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
      deletion.onsuccess = () => resolve(null);
      deletion.onerror = () => reject(deletion.error ?? new Error("Não foi possível finalizar a migração offline."));
      deletion.onblocked = () => reject(new Error("Feche as janelas antigas da Kontá antes de migrar os dados locais."));
    };
    request.onerror = () => {
      if (wasCreated) resolve(null);
      else reject(request.error ?? new Error("Não foi possível ler a base offline antiga."));
    };
  });
}

async function migrateLegacyDefaultData(database: IDBDatabase) {
  const markerTransaction = database.transaction("meta", "readonly");
  const markerDone = transactionDone(markerTransaction);
  const marker = await requestResult(markerTransaction.objectStore("meta").get(LEGACY_MIGRATION_KEY));
  await markerDone;
  if (marker) return;

  const legacyDatabase = await openLegacyDatabaseIfExists();
  const legacyRecords = legacyDatabase
    ? await Promise.all(STORE_NAMES.map(async (name) => [name, await readStore<unknown>(legacyDatabase, name)] as const))
    : [];
  legacyDatabase?.close();

  const transaction = database.transaction([...STORE_NAMES], "readwrite");
  const done = transactionDone(transaction);
  const meta = transaction.objectStore("meta");
  const markerRequest = meta.get(LEGACY_MIGRATION_KEY);
  markerRequest.onsuccess = () => {
    if (markerRequest.result) return;
    for (const [storeName, records] of legacyRecords) {
      const target = transaction.objectStore(storeName);
      for (const record of records) {
        const entry = record as { id?: string };
        if (typeof entry.id !== "string" || entry.id === OFFLINE_SESSION_KEY) continue;
        target.put(record);
      }
    }
    meta.put({ id: LEGACY_MIGRATION_KEY, value: new Date().toISOString() });
  };
  await done;
}

export async function selectOfflineOrganization(organizationId: string | null) {
  activeOrganizationId = organizationId;
  if (!organizationId) return;
  const database = await openDatabase(organizationId);
  if (organizationId === "default") await migrateLegacyDefaultData(database);
}

export function isOfflineOrganizationActive(organizationId: string) {
  return activeOrganizationId === organizationId;
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
    const random = Math.floor(Math.random() * 16);
    return (letter === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export async function getDeviceId(organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("meta");
  const existing = await requestResult(store.get(DEVICE_ID_KEY)) as { value?: string } | undefined;
  const deviceId = existing?.value ?? createId();
  if (!existing) store.put({ id: DEVICE_ID_KEY, value: deviceId });
  await done;
  return deviceId;
}

export async function loadCommerceData(organizationId?: string): Promise<CommerceData> {
  const [products, sales, expenses, cashSessions, meta] = await Promise.all([
    readAll<Product>("products", organizationId),
    readAll<Sale>("sales", organizationId),
    readAll<Expense>("expenses", organizationId),
    readAll<CashSession>("cash-sessions", organizationId),
    readAll<{ id: string; value: unknown }>("meta", organizationId),
  ]);
  const conflictsRecord = meta.find((entry) => entry.id === "stock-conflicts")?.value;
  const stockConflicts = Array.isArray(conflictsRecord) ? conflictsRecord as StockConflict[] : [];
  return { products, sales, expenses, cashSessions, stockConflicts };
}

export async function saveOfflineProfile(profile: CommerceProfile, offlineUntil = Date.now() + 7 * 24 * 60 * 60 * 1000) {
  const database = await openSessionDatabase();
  const transaction = database.transaction("session", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("session").put({
    id: OFFLINE_SESSION_KEY,
    profile,
    offlineUntil,
  });
  transaction.objectStore("session").put({ id: LEGACY_SESSION_CONSUMED_KEY, value: true });
  await done;
}

function normalizeOfflineProfile(profile: CommerceProfile): CommerceProfile {
  const legacy = profile as CommerceProfile & { enabledModules?: unknown; organizationId?: unknown };
  const enabledModules: StoreModuleId[] = Array.isArray(legacy.enabledModules)
    ? legacy.enabledModules.filter(isStoreModuleId)
    : ["commerce"];
  return {
    ...profile,
    organizationId: typeof legacy.organizationId === "string" && legacy.organizationId ? legacy.organizationId : "default",
    enabledModules: enabledModules.length ? enabledModules : ["commerce"],
  };
}

export async function loadOfflineProfile(): Promise<CommerceProfile | null> {
  const database = await openSessionDatabase();
  const transaction = database.transaction("session", "readonly");
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore("session");
  const valueRequest = sessionStore.get(OFFLINE_SESSION_KEY);
  const markerRequest = sessionStore.get(LEGACY_SESSION_CONSUMED_KEY);
  const [value, marker] = await Promise.all([requestResult(valueRequest), requestResult(markerRequest)]) as [
    | { profile?: CommerceProfile; offlineUntil?: number }
    | undefined,
    unknown,
  ];
  await done;
  if (value?.profile && value.offlineUntil && value.offlineUntil >= Date.now()) return normalizeOfflineProfile(value.profile);
  if (value || marker) return null;

  const legacyDatabase = await openLegacyDatabaseIfExists();
  if (!legacyDatabase) return null;
  try {
    const meta = await readStore<{ id: string; profile?: CommerceProfile; offlineUntil?: number }>(legacyDatabase, "meta");
    const legacySession = meta.find((entry) => entry.id === OFFLINE_SESSION_KEY);
    if (!legacySession?.profile || !legacySession.offlineUntil || legacySession.offlineUntil < Date.now()) return null;
    const profile = normalizeOfflineProfile(legacySession.profile);
    await saveOfflineProfile(profile, legacySession.offlineUntil);
    return profile;
  } finally {
    legacyDatabase.close();
  }
}

export async function clearOfflineProfile() {
  const database = await openSessionDatabase();
  const transaction = database.transaction("session", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("session").delete(OFFLINE_SESSION_KEY);
  transaction.objectStore("session").put({ id: LEGACY_SESSION_CONSUMED_KEY, value: true });
  await done;
}

export async function saveStoreName(name: string, organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("meta").put({ id: "store-name", value: name });
  await done;
}

export async function loadStoreName(organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction("meta", "readonly");
  const done = transactionDone(transaction);
  const record = await requestResult(transaction.objectStore("meta").get("store-name")) as { value?: string } | undefined;
  await done;
  return record?.value ?? "Minha Loja";
}

export async function adoptLegacyOperations(actorId: string, organizationId?: string) {
  const [database, deviceId] = await Promise.all([openDatabase(organizationId), getDeviceId(organizationId)]);
  const transaction = database.transaction("outbox", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("outbox");
  const request = store.getAll();
  request.onsuccess = () => {
    const operations = request.result as Array<OutboxOperation & { id: string; payload: Product | Sale | Expense }>;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const entry of operations) {
      if (entry.actorId && entry.deviceId && uuidPattern.test(entry.id)) continue;
      store.delete(entry.id);
      store.put({
        ...entry,
        id: uuidPattern.test(entry.id) ? entry.id : createId(),
        actorId,
        deviceId,
        createdAt: entry.createdAt ?? new Date().toISOString(),
        state: "pending",
      });
    }
  };
  await done;
}

function operation<T extends Product | Sale | Expense | CashSession>(type: OutboxOperation["type"], payload: T, actorId: string, deviceId: string, createdAt = new Date().toISOString()): OutboxOperation {
  return { id: createId(), type, createdAt, actorId, deviceId, state: "pending", payload };
}

function enqueueOperation(transaction: IDBTransaction, type: OutboxOperation["type"], payload: Product | Sale | Expense | CashSession, actorId: string, deviceId: string, createdAt?: string) {
  const meta = transaction.objectStore("meta");
  const request = meta.get(OPERATION_SEQUENCE_KEY);
  request.onsuccess = () => {
    const record = request.result as { value?: unknown } | undefined;
    const currentSequence = typeof record?.value === "number" ? record.value : 0;
    if (!Number.isSafeInteger(currentSequence) || currentSequence < 0 || currentSequence >= Number.MAX_SAFE_INTEGER) {
      transaction.abort();
      return;
    }
    const sequence = currentSequence + 1;
    meta.put({ id: OPERATION_SEQUENCE_KEY, value: sequence });
    transaction.objectStore("outbox").put({ ...operation(type, payload, actorId, deviceId, createdAt), sequence });
  };
}

function operationCashSessionId(entry: OutboxOperation) {
  if (entry.type === "cash-session.open" || entry.type === "cash-session.close") return (entry.payload as CashSession).id;
  if (entry.type === "sale.create" || entry.type === "expense.create") return (entry.payload as Sale | Expense).cashSessionId;
  return undefined;
}

function compareOperations(left: OutboxOperation, right: OutboxOperation) {
  if (left.sequence !== undefined && right.sequence !== undefined && left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }
  const byTime = left.createdAt.localeCompare(right.createdAt);
  if (byTime) return byTime;
  if (operationCashSessionId(left) !== operationCashSessionId(right)) return 0;
  if (left.type === "cash-session.open") return -1;
  if (right.type === "cash-session.open") return 1;
  if (left.type === "cash-session.close") return 1;
  if (right.type === "cash-session.close") return -1;
  return 0;
}

function sessionSyncState(operations: OutboxOperation[], sessionId: string) {
  const related = operations.filter((entry) => operationCashSessionId(entry) === sessionId);
  if (related.some((entry) => entry.state === "failed")) return "failed" as const;
  return related.length ? "pending" as const : "synced" as const;
}

export async function saveProduct(product: Product, actorId: string, organizationId?: string, preserveStock = false) {
  const [database, deviceId] = await Promise.all([openDatabase(organizationId), getDeviceId(organizationId)]);
  const transaction = database.transaction(["products", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  const products = transaction.objectStore("products");
  const existing = preserveStock ? await requestResult(products.get(product.id)) as Product | undefined : undefined;
  const record = existing ? { ...product, stock: existing.stock } : product;
  products.put(record);
  enqueueOperation(transaction, "product.save", record, actorId, deviceId);
  await done;
}

export async function saveSaleAndProducts(sale: Sale, products: Product[], actorId: string, organizationId?: string) {
  const [database, deviceId] = await Promise.all([openDatabase(organizationId), getDeviceId(organizationId)]);
  const transaction = database.transaction(["products", "sales", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  const productStore = transaction.objectStore("products");
  for (const product of products) productStore.put(product);
  transaction.objectStore("sales").put(sale);
  enqueueOperation(transaction, "sale.create", sale, actorId, deviceId, sale.createdAt);
  await done;
}

export async function saveExpense(expense: Expense, actorId: string, organizationId?: string) {
  const [database, deviceId] = await Promise.all([openDatabase(organizationId), getDeviceId(organizationId)]);
  const transaction = database.transaction(["expenses", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("expenses").put(expense);
  enqueueOperation(transaction, "expense.create", expense, actorId, deviceId, expense.createdAt);
  await done;
}

export async function saveCashSessionOpen(session: CashSession, actorId: string, organizationId?: string) {
  const [database, deviceId] = await Promise.all([openDatabase(organizationId), getDeviceId(organizationId)]);
  if (session.deviceId !== deviceId) throw new Error("A sessão de caixa pertence a outro dispositivo.");

  const transaction = database.transaction(["cash-sessions", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore("cash-sessions");
  const request = sessionStore.getAll();
  request.onsuccess = () => {
    const sessions = request.result as CashSession[];
    if (sessions.some((item) => item.deviceId === deviceId && item.status === "open")) {
      transaction.abort();
      return;
    }
    sessionStore.put(session);
    enqueueOperation(transaction, "cash-session.open", session, actorId, deviceId, session.openedAt);
  };

  try {
    await done;
  } catch (error) {
    const active = (await readAll<CashSession>("cash-sessions", organizationId)).some((item) => item.deviceId === deviceId && item.status === "open");
    if (active) throw new Error("Já existe uma sessão de caixa aberta neste dispositivo.");
    throw error;
  }
}

export async function saveCashSessionClose(session: CashSession, actorId: string, organizationId?: string) {
  const [database, deviceId] = await Promise.all([openDatabase(organizationId), getDeviceId(organizationId)]);
  if (session.deviceId !== deviceId || session.status !== "closed" || !session.closedAt || session.countedAmount === undefined) {
    throw new Error("Os dados do fecho de caixa são inválidos.");
  }

  const transaction = database.transaction(["cash-sessions", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore("cash-sessions");
  const request = sessionStore.get(session.id);
  let rejected = false;
  request.onsuccess = () => {
    const current = request.result as CashSession | undefined;
    if (!current || current.deviceId !== deviceId || current.status !== "open") {
      rejected = true;
      transaction.abort();
      return;
    }
    sessionStore.put(session);
    enqueueOperation(transaction, "cash-session.close", session, actorId, deviceId, session.closedAt);
  };

  try {
    await done;
  } catch (error) {
    if (rejected) throw new Error("Esta sessão de caixa já foi fechada neste dispositivo.");
    throw error;
  }
}

export async function getSyncOperations(includeFailed = false, organizationId?: string) {
  const operations = await readAll<OutboxOperation>("outbox", organizationId);
  const ordered = operations.sort(compareOperations);
  if (includeFailed) return ordered;
  const firstFailedIndex = ordered.findIndex((entry) => entry.state === "failed");
  return firstFailedIndex === -1 ? ordered : ordered.slice(0, firstFailedIndex);
}

export async function getPendingOperationCount(organizationId?: string) {
  return (await readAll<OutboxOperation>("outbox", organizationId)).length;
}

export async function markOperationsSynced(operationIds: string[], organizationId?: string) {
  if (operationIds.length === 0) return;
  const database = await openDatabase(organizationId);
  const transaction = database.transaction(["outbox", "sales", "expenses", "cash-sessions"], "readwrite");
  const done = transactionDone(transaction);
  const outbox = transaction.objectStore("outbox");
  const sales = transaction.objectStore("sales");
  const expenses = transaction.objectStore("expenses");
  const cashSessions = transaction.objectStore("cash-sessions");
  for (const id of operationIds) {
    const request = outbox.get(id);
    request.onsuccess = () => {
      const entry = request.result as OutboxOperation | undefined;
      if (!entry) return;
      outbox.delete(id);
      if (entry.type === "sale.create") sales.put({ ...entry.payload, syncState: "synced" });
      if (entry.type === "expense.create") expenses.put({ ...entry.payload, syncState: "synced" });
      const sessionId = operationCashSessionId(entry);
      if (sessionId) {
        const operationsRequest = outbox.getAll();
        operationsRequest.onsuccess = () => {
          const state = sessionSyncState(operationsRequest.result as OutboxOperation[], sessionId);
          const sessionRequest = cashSessions.get(sessionId);
          sessionRequest.onsuccess = () => {
            const session = sessionRequest.result as CashSession | undefined;
            if (session) cashSessions.put({ ...session, syncState: state });
          };
        };
      }
    };
  }
  await done;
}

export async function markOperationFailed(operationId: string, message: string, organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction(["outbox", "sales", "expenses", "cash-sessions"], "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("outbox");
  const request = store.get(operationId);
  request.onsuccess = () => {
    const current = request.result as OutboxOperation | undefined;
    if (!current) return;
    store.put({ ...current, state: "failed", lastError: message });
    if (current.type === "sale.create") transaction.objectStore("sales").put({ ...current.payload, syncState: "failed" });
    if (current.type === "expense.create") transaction.objectStore("expenses").put({ ...current.payload, syncState: "failed" });
    const sessionId = operationCashSessionId(current);
    if (sessionId) {
      const operationsRequest = store.getAll();
      operationsRequest.onsuccess = () => {
        const state = sessionSyncState(operationsRequest.result as OutboxOperation[], sessionId);
        const sessionStore = transaction.objectStore("cash-sessions");
        const sessionRequest = sessionStore.get(sessionId);
        sessionRequest.onsuccess = () => {
          const session = sessionRequest.result as CashSession | undefined;
          if (session) sessionStore.put({ ...session, syncState: state });
        };
      };
    }
  };
  await done;
}

export async function resetFailedOperations(organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction(["outbox", "cash-sessions"], "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("outbox");
  const request = store.getAll();
  request.onsuccess = () => {
    const operations = request.result as OutboxOperation[];
    for (const entry of operations) {
      if (entry.state !== "failed") continue;
      store.put({ ...entry, state: "pending", lastError: undefined });
      const sessionId = operationCashSessionId(entry);
      if (sessionId) {
        const sessionStore = transaction.objectStore("cash-sessions");
        const request = sessionStore.get(sessionId);
        request.onsuccess = () => {
          const session = request.result as CashSession | undefined;
          if (session) sessionStore.put({ ...session, syncState: "pending" });
        };
      }
    }
  };
  await done;
}

export async function saveStockConflicts(conflicts: StockConflict[], organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("meta").put({ id: "stock-conflicts", value: conflicts });
  await done;
}

export async function replaceWithServerSnapshot(snapshot: CommerceData, organizationId?: string) {
  const database = await openDatabase(organizationId);
  const transaction = database.transaction(["products", "sales", "expenses", "cash-sessions", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore("outbox");
  const request = outboxStore.getAll();
  request.onsuccess = () => {
    const pending = (request.result as OutboxOperation[]).sort(compareOperations);
    const products = new Map(snapshot.products.map((product) => [product.id, product]));
    const sales = new Map(snapshot.sales.map((sale) => [sale.id, sale]));
    const expenses = new Map(snapshot.expenses.map((expense) => [expense.id, expense]));
    const cashSessions = new Map((snapshot.cashSessions ?? []).map((session) => [session.id, session]));

    for (const entry of pending) {
      if (entry.type === "product.save") {
        const product = entry.payload as Product;
        const serverProduct = products.get(product.id);
        products.set(product.id, serverProduct ? { ...product, stock: serverProduct.stock, active: product.active ?? serverProduct.active, imageUrl: product.imageUrl ?? serverProduct.imageUrl } : product);
      } else if (entry.type === "sale.create") {
        const sale = { ...(entry.payload as Sale), syncState: entry.state === "failed" ? "failed" as const : "pending" as const };
        sales.set(sale.id, sale);
        for (const line of sale.items) {
          const product = products.get(line.productId);
          if (product) products.set(product.id, { ...product, stock: product.stock - line.quantity });
        }
      } else if (entry.type === "expense.create") {
        const expense = { ...(entry.payload as Expense), syncState: entry.state === "failed" ? "failed" as const : "pending" as const };
        expenses.set(expense.id, expense);
      } else if (entry.type === "cash-session.open" || entry.type === "cash-session.close") {
        const session = { ...(entry.payload as CashSession), syncState: entry.state === "failed" ? "failed" as const : "pending" as const };
        cashSessions.set(session.id, session);
      }
    }

    for (const [sessionId, session] of cashSessions) {
      const related = pending.filter((entry) => operationCashSessionId(entry) === sessionId);
      if (related.length) cashSessions.set(sessionId, { ...session, syncState: sessionSyncState(related, sessionId) });
    }

    for (const storeName of ["products", "sales", "expenses", "cash-sessions"] as const) {
      const store = transaction.objectStore(storeName);
      store.clear();
      const values = storeName === "products" ? [...products.values()]
        : storeName === "sales" ? [...sales.values()]
        : storeName === "expenses" ? [...expenses.values()]
        : [...cashSessions.values()];
      for (const value of values) store.put(value);
    }
    transaction.objectStore("meta").put({ id: "stock-conflicts", value: snapshot.stockConflicts ?? [] });
  };
  await done;
}
