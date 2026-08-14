import { Pool, type PoolClient } from "pg";
import type { DocumentStore } from "./types";

let pool: Pool | null = null;

export function postgresConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS docs (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_docs_collection ON docs(collection);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

let schemaReady: Promise<void> | null = null;

async function ready() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await getPool().connect();
      try {
        await ensureSchema(client);
      } finally {
        client.release();
      }
    })();
  }
  await schemaReady;
}

export function createPostgresDocumentStore(): DocumentStore {
  const p = getPool();

  return {
    async list<T extends { id: string }>(collection: string): Promise<T[]> {
      await ready();
      const res = await p.query(
        `SELECT data FROM docs WHERE collection = $1 ORDER BY updated_at ASC`,
        [collection],
      );
      return res.rows.map((r) => r.data as T);
    },

    async get<T extends { id: string }>(
      collection: string,
      id: string,
    ): Promise<T | null> {
      await ready();
      const res = await p.query(
        `SELECT data FROM docs WHERE collection = $1 AND id = $2`,
        [collection, id],
      );
      return res.rows[0] ? (res.rows[0].data as T) : null;
    },

    async put<T extends { id: string }>(collection: string, doc: T): Promise<T> {
      await ready();
      await p.query(
        `INSERT INTO docs (collection, id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (collection, id) DO UPDATE SET
           data = excluded.data,
           updated_at = NOW()`,
        [collection, doc.id, JSON.stringify(doc)],
      );
      return doc;
    },

    async putMany<T extends { id: string }>(
      collection: string,
      docs: T[],
    ): Promise<void> {
      await ready();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        for (const doc of docs) {
          await client.query(
            `INSERT INTO docs (collection, id, data, updated_at)
             VALUES ($1, $2, $3::jsonb, NOW())
             ON CONFLICT (collection, id) DO UPDATE SET
               data = excluded.data,
               updated_at = NOW()`,
            [collection, doc.id, JSON.stringify(doc)],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    async delete(collection: string, id: string): Promise<boolean> {
      await ready();
      const res = await p.query(
        `DELETE FROM docs WHERE collection = $1 AND id = $2`,
        [collection, id],
      );
      return (res.rowCount || 0) > 0;
    },

    async replaceAll<T extends { id: string }>(
      collection: string,
      docs: T[],
    ): Promise<void> {
      await ready();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM docs WHERE collection = $1`, [
          collection,
        ]);
        for (const doc of docs) {
          await client.query(
            `INSERT INTO docs (collection, id, data, updated_at)
             VALUES ($1, $2, $3::jsonb, NOW())`,
            [collection, doc.id, JSON.stringify(doc)],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    async getMeta(key: string): Promise<string | null> {
      await ready();
      const res = await p.query(`SELECT value FROM meta WHERE key = $1`, [key]);
      return res.rows[0]?.value ?? null;
    },

    async setMeta(key: string, value: string): Promise<void> {
      await ready();
      await p.query(
        `INSERT INTO meta (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    },
  };
}

export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = null;
  }
}
