import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import type { CreditPack } from "./types";

function normalize(row: CreditPack): CreditPack {
  return {
    id: row.id,
    name: row.name?.trim() || "Gói credit",
    credits: Math.max(1, Math.floor(row.credits || 0)),
    priceVnd: Math.max(0, Math.floor(row.priceVnd || 0)),
    active: row.active !== false,
    sortOrder: Math.floor(row.sortOrder || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCreditPacks(): Promise<CreditPack[]> {
  const store = await getDocumentStore();
  const rows = await store.list<CreditPack>(COLLECTIONS.creditPacks);
  return rows
    .map(normalize)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.priceVnd - b.priceVnd);
}

export async function listActiveCreditPacks(): Promise<CreditPack[]> {
  return (await listCreditPacks()).filter((p) => p.active);
}

export async function getCreditPack(id: string): Promise<CreditPack | null> {
  const store = await getDocumentStore();
  const found = await store.get<CreditPack>(COLLECTIONS.creditPacks, id);
  return found ? normalize(found) : null;
}

export async function createCreditPack(input: {
  name: string;
  credits: number;
  priceVnd: number;
  active?: boolean;
  sortOrder?: number;
}): Promise<CreditPack> {
  const store = await getDocumentStore();
  const now = new Date().toISOString();
  const existing = await listCreditPacks();
  const pack: CreditPack = normalize({
    id: uuidv4(),
    name: input.name,
    credits: input.credits,
    priceVnd: input.priceVnd,
    active: input.active !== false,
    sortOrder:
      input.sortOrder != null
        ? input.sortOrder
        : existing.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1,
    createdAt: now,
    updatedAt: now,
  });
  await store.put(COLLECTIONS.creditPacks, pack);
  return pack;
}

export async function updateCreditPack(
  id: string,
  patch: Partial<{
    name: string;
    credits: number;
    priceVnd: number;
    active: boolean;
    sortOrder: number;
  }>,
): Promise<CreditPack> {
  const store = await getDocumentStore();
  const cur = await store.get<CreditPack>(COLLECTIONS.creditPacks, id);
  if (!cur) throw new Error("Không tìm thấy gói credit.");
  const next = normalize({
    ...cur,
    name: typeof patch.name === "string" ? patch.name : cur.name,
    credits: patch.credits != null ? patch.credits : cur.credits,
    priceVnd: patch.priceVnd != null ? patch.priceVnd : cur.priceVnd,
    active: patch.active != null ? patch.active : cur.active,
    sortOrder: patch.sortOrder != null ? patch.sortOrder : cur.sortOrder,
    updatedAt: new Date().toISOString(),
  });
  await store.put(COLLECTIONS.creditPacks, next);
  return next;
}

export async function deleteCreditPack(id: string): Promise<boolean> {
  const store = await getDocumentStore();
  return store.delete(COLLECTIONS.creditPacks, id);
}
