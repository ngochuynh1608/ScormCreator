import { COLLECTIONS, getDocumentStore } from "../store";

export type UserUsage = {
  /** Same as userId — document id in the store. */
  id: string;
  userId: string;
  /** EverAI credits consumed (accumulated). */
  creditsUsed: number;
  /** Credits from purchases + admin grants (stacked on the plan limit). */
  extraCredits: number;
  /** Learners / students currently counted toward the plan. */
  studentsUsed: number;
  /** Extra project storage granted by admin, in MB (stacked on the plan limit). */
  extraStorageMb: number;
  updatedAt: string;
};

function normalize(row: UserUsage): UserUsage {
  return {
    id: row.id || row.userId,
    userId: row.userId || row.id,
    creditsUsed: Math.max(0, Math.floor(row.creditsUsed || 0)),
    extraCredits: Math.max(0, Math.floor(row.extraCredits || 0)),
    extraStorageMb: Math.max(0, Math.floor(row.extraStorageMb || 0)),
    studentsUsed: Math.max(0, Math.floor(row.studentsUsed || 0)),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

function emptyUsage(userId: string): UserUsage {
  return {
    id: userId,
    userId,
    creditsUsed: 0,
    extraCredits: 0,
    extraStorageMb: 0,
    studentsUsed: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const store = await getDocumentStore();
  const found = await store.get<UserUsage>(COLLECTIONS.usage, userId);
  if (found) return normalize(found);
  return emptyUsage(userId);
}

async function putUsage(next: UserUsage): Promise<UserUsage> {
  const store = await getDocumentStore();
  const row = normalize({ ...next, updatedAt: new Date().toISOString() });
  await store.put(COLLECTIONS.usage, row);
  return row;
}

export async function addCreditsUsed(
  userId: string,
  amount: number,
): Promise<UserUsage> {
  const add = Math.max(0, Math.ceil(amount));
  if (!userId || add === 0) return getUserUsage(userId);

  const current = await getUserUsage(userId);
  return putUsage({
    ...current,
    creditsUsed: current.creditsUsed + add,
  });
}

export async function addExtraCredits(
  userId: string,
  amount: number,
): Promise<UserUsage> {
  const add = Math.max(0, Math.ceil(amount));
  if (!userId || add === 0) return getUserUsage(userId);

  const current = await getUserUsage(userId);
  return putUsage({
    ...current,
    extraCredits: current.extraCredits + add,
  });
}

export async function addExtraStorageMb(
  userId: string,
  amount: number,
): Promise<UserUsage> {
  const add = Math.max(0, Math.ceil(amount));
  if (!userId || add === 0) return getUserUsage(userId);

  const current = await getUserUsage(userId);
  return putUsage({
    ...current,
    extraStorageMb: current.extraStorageMb + add,
  });
}
