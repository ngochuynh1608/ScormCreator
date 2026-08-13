import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import type { CreditTransaction, CreditTransactionType } from "./types";

export async function recordCreditTransaction(input: {
  userId: string;
  type: CreditTransactionType;
  amount: number;
  extraCreditsAfter?: number;
  creditsUsedAfter?: number;
  orderId?: string;
  jobId?: string;
  note?: string;
}): Promise<CreditTransaction> {
  const store = await getDocumentStore();
  const row: CreditTransaction = {
    id: uuidv4(),
    userId: input.userId,
    type: input.type,
    amount: Math.trunc(input.amount),
    extraCreditsAfter: input.extraCreditsAfter,
    creditsUsedAfter: input.creditsUsedAfter,
    orderId: input.orderId,
    jobId: input.jobId,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  await store.put(COLLECTIONS.creditTransactions, row);
  return row;
}

export async function listCreditTransactions(options?: {
  userId?: string;
  limit?: number;
}): Promise<CreditTransaction[]> {
  const store = await getDocumentStore();
  let rows = await store.list<CreditTransaction>(COLLECTIONS.creditTransactions);
  if (options?.userId) {
    rows = rows.filter((r) => r.userId === options.userId);
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (options?.limit != null) {
    return rows.slice(0, Math.max(0, options.limit));
  }
  return rows;
}
