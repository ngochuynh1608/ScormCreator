import path from "path";
import type { DocumentStore } from "./types";
import { migrateJsonIntoStore } from "./migrate-json";
import { dataRoot } from "../storage";

let storePromise: Promise<DocumentStore> | null = null;

export function postgresConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function loadSqliteStore(): Promise<DocumentStore | null> {
  try {
    const mod = await import("./sqlite");
    return mod.createSqliteDocumentStore();
  } catch (err) {
    console.warn(
      "[store] better-sqlite3 unavailable — using JSON file store.",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * App document store (users, plans, usage, settings, jobs).
 * Postgres when DATABASE_URL is set; else SQLite; else JSON files (Windows without VS).
 */
export async function getDocumentStore(): Promise<DocumentStore> {
  if (!storePromise) {
    storePromise = (async () => {
      let store: DocumentStore;
      if (postgresConfigured()) {
        store = (await import("./postgres")).createPostgresDocumentStore();
      } else {
        const sqlite = await loadSqliteStore();
        if (sqlite) {
          store = sqlite;
        } else {
          const { createJsonDocumentStore, ensureJsonStoreDirs } =
            await import("./json-store");
          await ensureJsonStoreDirs();
          store = createJsonDocumentStore();
        }
      }
      await migrateJsonIntoStore(store);
      return store;
    })();
  }
  return storePromise;
}

export { COLLECTIONS } from "./types";
export type { DocumentStore } from "./types";

export function sqliteFilePath() {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
  }
  return path.join(dataRoot(), "app.sqlite");
}
