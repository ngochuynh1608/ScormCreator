import path from "path";
import type { DocumentStore } from "./types";
import { migrateJsonIntoStore } from "./migrate-json";
import { dataRoot } from "../storage";

let storePromise: Promise<DocumentStore> | null = null;

export function postgresConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * App document store (users, plans, usage, settings, jobs).
 * Uses Postgres when DATABASE_URL is set; otherwise SQLite.
 * Dynamic imports avoid loading better-sqlite3 in Postgres-only containers.
 */
export async function getDocumentStore(): Promise<DocumentStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const store = postgresConfigured()
        ? (await import("./postgres")).createPostgresDocumentStore()
        : (await import("./sqlite")).createSqliteDocumentStore();
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
