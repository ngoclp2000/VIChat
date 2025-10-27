/* eslint-disable @typescript-eslint/no-explicit-any */
const DB_NAME = 'vichat-sdk';
const STORE_NAME = 'outbox';

export interface QueuedMessage<T = unknown> {
  id: string;
  payload: T;
  createdAt: number;
}

export interface OutboxStorage<T> {
  put(message: QueuedMessage<T>): Promise<void>;
  take(limit: number): Promise<QueuedMessage<T>[]>;
  delete(ids: string[]): Promise<void>;
}

class MemoryStorage<T> implements OutboxStorage<T> {
  private readonly items: QueuedMessage<T>[] = [];

  async put(message: QueuedMessage<T>): Promise<void> {
    this.items.push(message);
  }

  async take(limit: number): Promise<QueuedMessage<T>[]> {
    return this.items.slice(0, limit);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      const idx = this.items.findIndex((item) => item.id === id);
      if (idx >= 0) {
        this.items.splice(idx, 1);
      }
    }
  }
}

async function withStore<T>(mode: IDBTransactionMode, handler: (store: any) => Promise<T>): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, mode);
  const store = tx.objectStore(STORE_NAME);
  const result = await handler(store as any);
  await tx.done;
  return result;
}

async function openDb(): Promise<IDBPDatabase> {
  const { openDB } = await import('idb');
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    }
  });
}

class IndexedDbStorage<T> implements OutboxStorage<T> {
  async put(message: QueuedMessage<T>): Promise<void> {
    await withStore('readwrite', async (store) => {
      await store.put(message);
    });
  }

  async take(limit: number): Promise<QueuedMessage<T>[]> {
    return withStore('readonly', async (store) => {
      const all = await store.getAll();
      return all.slice(0, limit) as QueuedMessage<T>[];
    });
  }

  async delete(ids: string[]): Promise<void> {
    await withStore('readwrite', async (store) => {
      await Promise.all(ids.map((id) => store.delete(id)));
    });
  }
}

export async function createOutboxStorage<T>(): Promise<OutboxStorage<T>> {
  if (typeof indexedDB === 'undefined') {
    return new MemoryStorage<T>();
  }

  try {
    await openDb();
    return new IndexedDbStorage<T>();
  } catch (err) {
    console.warn('[ChatKit] Falling back to in-memory outbox', err);
    return new MemoryStorage<T>();
  }
}

export type IDBPDatabase = Awaited<ReturnType<typeof import('idb').openDB>>;
