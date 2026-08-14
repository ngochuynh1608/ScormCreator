import fs from "fs/promises";
import path from "path";
import { dataRoot, readJson, writeJson } from "../storage";
import type { DocumentStore } from "./types";

/**
 * File-based document store for local Windows when better-sqlite3
 * cannot compile (no Visual Studio C++ tools). Not for multi-process prod.
 */
export function createJsonDocumentStore(): DocumentStore {
  const root = path.join(dataRoot(), "json-store");

  function collectionPath(collection: string) {
    return path.join(root, `${collection}.json`);
  }

  function metaPath() {
    return path.join(root, "_meta.json");
  }

  async function readCollection<T extends { id: string }>(
    collection: string,
  ): Promise<T[]> {
    const data = await readJson<T[]>(collectionPath(collection));
    return Array.isArray(data) ? data : [];
  }

  async function writeCollection<T extends { id: string }>(
    collection: string,
    docs: T[],
  ) {
    await writeJson(collectionPath(collection), docs);
  }

  return {
    async list<T extends { id: string }>(collection: string): Promise<T[]> {
      return readCollection<T>(collection);
    },

    async get<T extends { id: string }>(
      collection: string,
      id: string,
    ): Promise<T | null> {
      const docs = await readCollection<T>(collection);
      return docs.find((d) => d.id === id) || null;
    },

    async put<T extends { id: string }>(collection: string, doc: T): Promise<T> {
      const docs = await readCollection<T>(collection);
      const i = docs.findIndex((d) => d.id === doc.id);
      if (i >= 0) docs[i] = doc;
      else docs.push(doc);
      await writeCollection(collection, docs);
      return doc;
    },

    async putMany<T extends { id: string }>(
      collection: string,
      docs: T[],
    ): Promise<void> {
      const existing = await readCollection<T>(collection);
      const byId = new Map(existing.map((d) => [d.id, d]));
      for (const doc of docs) byId.set(doc.id, doc);
      await writeCollection(collection, [...byId.values()]);
    },

    async delete(collection: string, id: string): Promise<boolean> {
      const docs = await readCollection<{ id: string }>(collection);
      const next = docs.filter((d) => d.id !== id);
      if (next.length === docs.length) return false;
      await writeCollection(collection, next);
      return true;
    },

    async replaceAll<T extends { id: string }>(
      collection: string,
      docs: T[],
    ): Promise<void> {
      await writeCollection(collection, docs);
    },

    async getMeta(key: string): Promise<string | null> {
      const meta = (await readJson<Record<string, string>>(metaPath())) || {};
      return meta[key] ?? null;
    },

    async setMeta(key: string, value: string): Promise<void> {
      const meta = (await readJson<Record<string, string>>(metaPath())) || {};
      meta[key] = value;
      await writeJson(metaPath(), meta);
    },
  };
}

export async function ensureJsonStoreDirs() {
  await fs.mkdir(path.join(dataRoot(), "json-store"), { recursive: true });
}
