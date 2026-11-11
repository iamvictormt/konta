import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { clearOfflineProfile, loadOfflineProfile, saveOfflineProfile } from "../app/lib/offline-store";
import type { CommerceProfile } from "../app/lib/model";

const indexedDB = new IDBFactory();
Object.defineProperty(globalThis, "window", { value: { indexedDB }, configurable: true });

const profile: CommerceProfile = {
  id: "owner-1",
  name: "Proprietário",
  email: "owner@example.test",
  role: "admin",
  organizationId: "default",
  enabledModules: ["commerce"],
  isOwner: true,
  isPlatformAdmin: false,
};

function openDatabase(name: string, version?: number, setup?: (database: IDBDatabase) => void) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => setup?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function finish(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readSession() {
  const database = await openDatabase("konta-session", 1);
  try {
    const transaction = database.transaction("session", "readonly");
    const done = finish(transaction);
    const request = transaction.objectStore("session").get("offline-session");
    const value = await new Promise<{ offlineUntil: number } | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await done;
    return value;
  } finally { database.close(); }
}

test("legacy offline sessions retain their expiry and cannot return after sign-out", async () => {
  const legacy = await openDatabase("konta-commerce", 1, (database) => {
    database.createObjectStore("meta", { keyPath: "id" });
  });
  const originalExpiry = Date.now() + 60_000;
  const transaction = legacy.transaction("meta", "readwrite");
  const saved = finish(transaction);
  transaction.objectStore("meta").put({ id: "offline-session", profile, offlineUntil: originalExpiry });
  await saved;
  legacy.close();

  assert.deepEqual(await loadOfflineProfile(), profile);
  assert.equal((await readSession())?.offlineUntil, originalExpiry);

  await clearOfflineProfile();
  assert.equal(await loadOfflineProfile(), null);

  await saveOfflineProfile(profile, Date.now() - 1);
  assert.equal(await loadOfflineProfile(), null);

  const beforeSave = Date.now();
  await saveOfflineProfile(profile);
  const afterSave = Date.now();
  const expiry = (await readSession())?.offlineUntil ?? 0;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  assert.ok(expiry >= beforeSave + sevenDays && expiry <= afterSave + sevenDays);
  assert.deepEqual(await loadOfflineProfile(), profile);
});
