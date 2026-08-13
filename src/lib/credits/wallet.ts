import { listJobs } from "../db";
import { findUserById } from "../auth/users";
import { resolvePlanForUser } from "../auth/plans";
import {
  addCreditsUsed,
  addExtraCredits,
  getUserUsage,
} from "../auth/usage";
import { recordCreditTransaction } from "./transactions";
import {
  InsufficientCreditsError,
  type CreditSnapshot,
} from "./types";

let lockChain: Promise<void> = Promise.resolve();

/** Serialize credit check + grant + TTS enqueue in this process. */
export function withCreditLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function getReservedCredits(ownerId: string): Promise<number> {
  if (!ownerId) return 0;
  const jobs = await listJobs();
  let sum = 0;
  for (const job of jobs) {
    if (job.ownerId !== ownerId) continue;
    if (job.provider === "mock") continue;
    if (job.status !== "queued" && job.status !== "running") continue;
    sum += Math.max(0, Math.ceil(job.estimatedCredits || 0));
  }
  return sum;
}

export function computeAvailable(input: {
  planLimit: number;
  extraCredits: number;
  creditsUsed: number;
  reserved: number;
}): number {
  return Math.max(
    0,
    Math.floor(input.planLimit) +
      Math.floor(input.extraCredits) -
      Math.floor(input.creditsUsed) -
      Math.floor(input.reserved),
  );
}

export async function getCreditSnapshot(
  userId: string,
): Promise<CreditSnapshot> {
  const user = await findUserById(userId);
  const plan = await resolvePlanForUser(user?.planId, {
    expiresAt: user?.planExpiresAt,
    userId: user?.id,
  });
  const usage = await getUserUsage(userId);
  const reserved = await getReservedCredits(userId);
  const planLimit = plan.everaiCredits;
  const ceiling = planLimit + usage.extraCredits;
  return {
    creditsUsed: usage.creditsUsed,
    extraCredits: usage.extraCredits,
    planLimit,
    reserved,
    ceiling,
    available: computeAvailable({
      planLimit,
      extraCredits: usage.extraCredits,
      creditsUsed: usage.creditsUsed,
      reserved,
    }),
  };
}

export async function getCreditSnapshots(
  userIds: string[],
): Promise<Record<string, CreditSnapshot>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out: Record<string, CreditSnapshot> = {};
  await Promise.all(
    unique.map(async (id) => {
      out[id] = await getCreditSnapshot(id);
    }),
  );
  return out;
}

export async function assertCreditsAvailable(
  userId: string,
  needed: number,
): Promise<CreditSnapshot> {
  const snapshot = await getCreditSnapshot(userId);
  const need = Math.max(0, Math.ceil(needed));
  if (need > 0 && snapshot.available < need) {
    throw new InsufficientCreditsError(need, snapshot.available);
  }
  return snapshot;
}

export async function settleTtsDebit(input: {
  userId: string;
  amount: number;
  jobId: string;
}): Promise<void> {
  const add = Math.max(0, Math.ceil(input.amount));
  if (!input.userId || add === 0) return;
  await withCreditLock(async () => {
    const usage = await addCreditsUsed(input.userId, add);
    await recordCreditTransaction({
      userId: input.userId,
      type: "tts_debit",
      amount: -add,
      extraCreditsAfter: usage.extraCredits,
      creditsUsedAfter: usage.creditsUsed,
      jobId: input.jobId,
    }).catch(() => undefined);
  });
}

export async function grantCredits(input: {
  userId: string;
  amount: number;
  adminUserId: string;
  note?: string;
}): Promise<CreditSnapshot> {
  const add = Math.floor(input.amount);
  if (add < 1) throw new Error("Số credit phải là số nguyên dương.");
  const user = await findUserById(input.userId);
  if (!user) throw new Error("Không tìm thấy người dùng.");

  return withCreditLock(async () => {
    const usage = await addExtraCredits(input.userId, add);
    await recordCreditTransaction({
      userId: input.userId,
      type: "admin_grant",
      amount: add,
      extraCreditsAfter: usage.extraCredits,
      creditsUsedAfter: usage.creditsUsed,
      note: input.note?.trim() || `Admin cộng ${add} credit`,
    });
    return getCreditSnapshot(input.userId);
  });
}
