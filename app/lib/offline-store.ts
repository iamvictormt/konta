import type {
  CommerceData,
  CommerceProfile,
  Expense,
  OutboxOperation,
  Product,
  Sale,
  StockConflict,
} from "./model";

const DATABASE_NAME = "konta-commerce";
const DATABASE_VERSION = 2;
const STORE_NAMES = ["products", "sales", "expenses", "outbox", "meta"] as const;
const OFFLINE_SESSION_KEY = "offline-session";
const DEVICE_ID_KEY = "device-id";

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não suporta armazenamento offline."));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento local."));
    request.onblocked = () => reject(new Error("Feche outras janelas da Kontá para atualizar o armazenamento."));
  });

  return databasePromise;
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

async function readAll<T>(storeName: (typeof STORE_NAMES)[number]) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const values = await requestResult(transaction.objectStore(storeName).getAll());
  await done;
  return values as T[];
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
    const random = Math.floor(Math.random() * 16);
    return (letter === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

async function getDeviceId() {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("meta");
  const existing = await requestResult(store.get(DEVICE_ID_KEY)) as { value?: string } | undefined;
  const deviceId = existing?.value ?? createId();
  if (!existing) store.put({ id: DEVICE_ID_KEY, value: deviceId });
  await done;
  return deviceId;
}

export async function loadCommerceData(): Promise<CommerceData> {
  const [products, sales, expenses, meta] = await Promise.all([
    readAll<Product>("products"),
    readAll<Sale>("sales"),
    readAll<Expense>("expenses"),
    readAll<{ id: string; value: unknown }>("meta"),
  ]);
  const conflictsRecord = meta.find((entry) => entry.id === "stock-conflicts")?.value;
  const stockConflicts = Array.isArray(conflictsRecord) ? conflictsRecord as StockConflict[] : [];
  return { products, sales, expenses, stockConflicts };
}

export async function saveOfflineProfile(profile: CommerceProfile) {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("meta").put({
    id: OFFLINE_SESSION_KEY,
    profile,
    offlineUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  await done;
}

export async function loadOfflineProfile(): Promise<CommerceProfile | null> {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readonly");
  const done = transactionDone(transaction);
  const value = await requestResult(transaction.objectStore("meta").get(OFFLINE_SESSION_KEY)) as
    | { profile?: CommerceProfile; offlineUntil?: number }
    | undefined;
  await done;
  if (!value?.profile || !value.offlineUntil || value.offlineUntil < Date.now()) return null;
  return value.profile;
}

export async function clearOfflineProfile() {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("meta").delete(OFFLINE_SESSION_KEY);
  await done;
}

export async function saveStoreName(name: string) {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("meta").put({ id: "store-name", value: name });
  await done;
}

export async function loadStoreName() {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readonly");
  const done = transactionDone(transaction);
  const record = await requestResult(transaction.objectStore("meta").get("store-name")) as { value?: string } | undefined;
  await done;
  return record?.value ?? "Minha Loja";
}

export async function adoptLegacyOperations(actorId: string) {
  const [database, deviceId] = await Promise.all([openDatabase(), getDeviceId()]);
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

function operation<T extends Product | Sale | Expense>(type: OutboxOperation["type"], payload: T, actorId: string, deviceId: string): OutboxOperation {
  return { id: createId(), type, createdAt: new Date().toISOString(), actorId, deviceId, state: "pending", payload };
}

export async function saveProduct(product: Product, actorId: string) {
  const [database, deviceId] = await Promise.all([openDatabase(), getDeviceId()]);
  const transaction = database.transaction(["products", "outbox"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("products").put(product);
  transaction.objectStore("outbox").put(operation("product.save", product, actorId, deviceId));
  await done;
}

export async function saveSaleAndProducts(sale: Sale, products: Product[], actorId: string) {
  const [database, deviceId] = await Promise.all([openDatabase(), getDeviceId()]);
  const transaction = database.transaction(["products", "sales", "outbox"], "readwrite");
  const done = transactionDone(transaction);
  const productStore = transaction.objectStore("products");
  for (const product of products) productStore.put(product);
  transaction.objectStore("sales").put(sale);
  transaction.objectStore("outbox").put(operation("sale.create", sale, actorId, deviceId));
  await done;
}

export async function saveExpense(expense: Expense, actorId: string) {
  const [database, deviceId] = await Promise.all([openDatabase(), getDeviceId()]);
  const transaction = database.transaction(["expenses", "outbox"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("expenses").put(expense);
  transaction.objectStore("outbox").put(operation("expense.create", expense, actorId, deviceId));
  await done;
}

export async function getSyncOperations(includeFailed = false) {
  const operations = await readAll<OutboxOperation>("outbox");
  return operations
    .filter((entry) => includeFailed || entry.state !== "failed")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function getPendingOperationCount() {
  return (await readAll<OutboxOperation>("outbox")).length;
}

export async function markOperationsSynced(operationIds: string[]) {
  if (operationIds.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction(["outbox", "sales", "expenses"], "readwrite");
  const done = transactionDone(transaction);
  const outbox = transaction.objectStore("outbox");
  const sales = transaction.objectStore("sales");
  const expenses = transaction.objectStore("expenses");
  for (const id of operationIds) {
    const request = outbox.get(id);
    request.onsuccess = () => {
      const entry = request.result as OutboxOperation | undefined;
      if (!entry) return;
      outbox.delete(id);
      if (entry.type === "sale.create") sales.put({ ...entry.payload, syncState: "synced" });
      if (entry.type === "expense.create") expenses.put({ ...entry.payload, syncState: "synced" });
    };
  }
  await done;
}

export async function markOperationFailed(operationId: string, message: string) {
  const database = await openDatabase();
  const transaction = database.transaction(["outbox", "sales", "expenses"], "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("outbox");
  const request = store.get(operationId);
  request.onsuccess = () => {
    const current = request.result as OutboxOperation | undefined;
    if (!current) return;
    store.put({ ...current, state: "failed", lastError: message });
    if (current.type === "sale.create") transaction.objectStore("sales").put({ ...current.payload, syncState: "failed" });
    if (current.type === "expense.create") transaction.objectStore("expenses").put({ ...current.payload, syncState: "failed" });
  };
  await done;
}

export async function resetFailedOperations() {
  const database = await openDatabase();
  const transaction = database.transaction("outbox", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("outbox");
  const request = store.getAll();
  request.onsuccess = () => {
    const operations = request.result as OutboxOperation[];
    for (const entry of operations) if (entry.state === "failed") store.put({ ...entry, state: "pending", lastError: undefined });
  };
  await done;
}

export async function saveStockConflicts(conflicts: StockConflict[]) {
  const database = await openDatabase();
  const transaction = database.transaction("meta", "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("meta").put({ id: "stock-conflicts", value: conflicts });
  await done;
}

export async function replaceWithServerSnapshot(snapshot: CommerceData) {
  const database = await openDatabase();
  const transaction = database.transaction(["products", "sales", "expenses", "outbox", "meta"], "readwrite");
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore("outbox");
  const request = outboxStore.getAll();
  request.onsuccess = () => {
    const pending = request.result as OutboxOperation[];
    const products = new Map(snapshot.products.map((product) => [product.id, product]));
    const sales = new Map(snapshot.sales.map((sale) => [sale.id, sale]));
    const expenses = new Map(snapshot.expenses.map((expense) => [expense.id, expense]));

    for (const entry of pending) {
      if (entry.type === "product.save") {
        const product = entry.payload as Product;
        const serverProduct = products.get(product.id);
        products.set(product.id, serverProduct ? { ...product, stock: serverProduct.stock } : product);
      } else if (entry.type === "sale.create") {
        const sale = { ...(entry.payload as Sale), syncState: entry.state === "failed" ? "failed" as const : "pending" as const };
        sales.set(sale.id, sale);
        for (const line of sale.items) {
          const product = products.get(line.productId);
          if (product) products.set(product.id, { ...product, stock: product.stock - line.quantity });
        }
      } else {
        const expense = { ...(entry.payload as Expense), syncState: entry.state === "failed" ? "failed" as const : "pending" as const };
        expenses.set(expense.id, expense);
      }
    }

    for (const storeName of ["products", "sales", "expenses"] as const) {
      const store = transaction.objectStore(storeName);
      store.clear();
      const values = storeName === "products" ? [...products.values()]
        : storeName === "sales" ? [...sales.values()]
        : [...expenses.values()];
      for (const value of values) store.put(value);
    }
    transaction.objectStore("meta").put({ id: "stock-conflicts", value: snapshot.stockConflicts ?? [] });
  };
  await done;
}
