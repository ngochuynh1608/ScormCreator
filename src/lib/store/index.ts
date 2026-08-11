import type { DocumentStore } from "./types";
import { createSqliteDocumentStore } from "./sqlite";
import { migrateJsonIntoStore } from "./migrate-json";

let storePromise: Promise<DocumentStore> | null = null;

/**
 * App document store (users, plans, usage, settings, jobs).
 * Backed by SQLite today; swap implementation here for MongoDB later.
 */
export async function getDocumentStore(): Promise<DocumentStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const store = createSqliteDocumentStore();
      await migrateJsonIntoStore(store);
      return store;
    })();
  }
  return storePromise;
}

export { COLLECTIONS } from "./types";
export type { DocumentStore } from "./types";
export { sqliteFilePath } from "./sqlite";
