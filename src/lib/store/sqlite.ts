import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { DocumentStore } from "./types";
import { dataRoot } from "../storage";

function sqlitePath() {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
  }
  return path.join(dataRoot(), "app.sqlite");
}

let dbSingleton: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbSingleton) return dbSingleton;
  const file = sqlitePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_docs_collection ON docs(collection);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  dbSingleton = db;
  return db;
}

export function createSqliteDocumentStore(): DocumentStore {
  const db = getDb();

  return {
    async list<T extends { id: string }>(collection: string): Promise<T[]> {
      const rows = db
        .prepare(
          `SELECT data FROM docs WHERE collection = ? ORDER BY updated_at ASC`,
        )
        .all(collection) as { data: string }[];
      return rows.map((r) => JSON.parse(r.data) as T);
    },

    async get<T extends { id: string }>(
      collection: string,
      id: string,
    ): Promise<T | null> {
      const row = db
        .prepare(`SELECT data FROM docs WHERE collection = ? AND id = ?`)
        .get(collection, id) as { data: string } | undefined;
      return row ? (JSON.parse(row.data) as T) : null;
    },

    async put<T extends { id: string }>(collection: string, doc: T): Promise<T> {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO docs (collection, id, data, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(collection, id) DO UPDATE SET
           data = excluded.data,
           updated_at = excluded.updated_at`,
      ).run(collection, doc.id, JSON.stringify(doc), now);
      return doc;
    },

    async putMany<T extends { id: string }>(
      collection: string,
      docs: T[],
    ): Promise<void> {
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO docs (collection, id, data, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(collection, id) DO UPDATE SET
           data = excluded.data,
           updated_at = excluded.updated_at`,
      );
      const tx = db.transaction((items: T[]) => {
        for (const doc of items) {
          stmt.run(collection, doc.id, JSON.stringify(doc), now);
        }
      });
      tx(docs);
    },

    async delete(collection: string, id: string): Promise<boolean> {
      const info = db
        .prepare(`DELETE FROM docs WHERE collection = ? AND id = ?`)
        .run(collection, id);
      return info.changes > 0;
    },

    async replaceAll<T extends { id: string }>(
      collection: string,
      docs: T[],
    ): Promise<void> {
      const now = new Date().toISOString();
      const del = db.prepare(`DELETE FROM docs WHERE collection = ?`);
      const ins = db.prepare(
        `INSERT INTO docs (collection, id, data, updated_at) VALUES (?, ?, ?, ?)`,
      );
      const tx = db.transaction((items: T[]) => {
        del.run(collection);
        for (const doc of items) {
          ins.run(collection, doc.id, JSON.stringify(doc), now);
        }
      });
      tx(docs);
    },

    async getMeta(key: string): Promise<string | null> {
      const row = db
        .prepare(`SELECT value FROM meta WHERE key = ?`)
        .get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },

    async setMeta(key: string, value: string): Promise<void> {
      db.prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(key, value);
    },
  };
}

export function sqliteFilePath() {
  return sqlitePath();
}
