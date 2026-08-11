import { COLLECTIONS, getDocumentStore } from "../store";

export type UserUsage = {
  /** Same as userId — document id in the store. */
  id: string;
  userId: string;
  /** EverAI credits consumed (accumulated). */
  creditsUsed: number;
  /** Learners / students currently counted toward the plan. */
  studentsUsed: number;
  updatedAt: string;
};

function normalize(row: UserUsage): UserUsage {
  return {
    id: row.id || row.userId,
    userId: row.userId || row.id,
    creditsUsed: Math.max(0, Math.floor(row.creditsUsed || 0)),
    studentsUsed: Math.max(0, Math.floor(row.studentsUsed || 0)),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const store = await getDocumentStore();
  const found = await store.get<UserUsage>(COLLECTIONS.usage, userId);
  if (found) return normalize(found);
  return {
    id: userId,
    userId,
    creditsUsed: 0,
    studentsUsed: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function addCreditsUsed(
  userId: string,
  amount: number,
): Promise<UserUsage> {
  const add = Math.max(0, Math.ceil(amount));
  if (!userId || add === 0) return getUserUsage(userId);

  const store = await getDocumentStore();
  const current = await getUserUsage(userId);
  const next: UserUsage = {
    id: userId,
    userId,
    creditsUsed: current.creditsUsed + add,
    studentsUsed: current.studentsUsed,
    updatedAt: new Date().toISOString(),
  };
  await store.put(COLLECTIONS.usage, next);
  return next;
}
