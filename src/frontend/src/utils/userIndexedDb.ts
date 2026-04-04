const DB_NAME = "creditshop_local";
const DB_VERSION = 1;
const STORES = [
  "products",
  "customers",
  "transactions",
  "transaction_items",
] as const;

type StoreName = (typeof STORES)[number];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("user_id", "user_id", { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putManyByUser(
  storeName: StoreName,
  userId: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const row of rows) {
      store.put({ ...row, user_id: userId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Read all rows for a given user from a local IndexedDB store.
 * Used as an offline fallback when the backend is unreachable.
 */
export async function getAllByUser<T = Record<string, unknown>>(
  storeName: StoreName,
  userId: string,
): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = store.index("user_id");
    const req = index.getAll(IDBKeyRange.only(userId));
    req.onsuccess = () => {
      db.close();
      resolve(req.result as T[]);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function clearUserData(userId: string): Promise<void> {
  const db = await openDb();
  for (const storeName of STORES) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const index = store.index("user_id");
      const req = index.openCursor(IDBKeyRange.only(userId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  db.close();
}
