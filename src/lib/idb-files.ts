/** Browser IndexedDB storage for drawing PDFs / images / IFC blobs (survives refresh). */

const DB_NAME = "piecemark-files-v1";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

export async function idbPutFile(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB put failed"));
  });
  db.close();
}

export async function idbGetFile(key: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IDB get failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function idbDeleteFile(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export function sheetAssetKey(drawingId: string) {
  return `sheet:${drawingId}`;
}

export function ifcAssetKey(name: string) {
  return `ifc:${name}`;
}

export function ifcUploadKey() {
  return "ifc:user-upload";
}
