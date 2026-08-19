import { NextResponse } from "next/server";
import { listProjects } from "../db";
import { findUserById } from "./users";
import { listPlans, resolvePlanForUser } from "./plans";
import { getUserUsage } from "./usage";
import { isPlanExpired } from "./plan-expiry";
import { projectSizeBytes } from "../storage";
import { formatBytes, storageLimitBytes } from "../format";
import type { PublicUser, SubscriptionPlan } from "./types";

export type StorageSnapshot = {
  usedBytes: number;
  extraMb: number;
  planLimitMb: number;
  limitBytes: number;
  remainingBytes: number;
};

export class PresentationLimitError extends Error {
  used: number;
  limit: number;

  constructor(used: number, limit: number) {
    super(
      `Gói hiện tại cho phép tối đa ${limit.toLocaleString("vi-VN")} trình chiếu. Nâng cấp gói để tạo thêm.`,
    );
    this.name = "PresentationLimitError";
    this.used = used;
    this.limit = limit;
  }
}

export class StorageLimitError extends Error {
  used: number;
  limit: number;

  constructor(used: number, limit: number) {
    super(
      `Gói hiện tại cho phép tối đa ${formatBytes(limit)} dữ liệu (đang dùng ${formatBytes(used)}). Nâng cấp gói hoặc xóa bài giảng để thêm dung lượng.`,
    );
    this.name = "StorageLimitError";
    this.used = used;
    this.limit = limit;
  }
}

export async function assertCanCreatePresentation(userId: string) {
  const user = await findUserById(userId);
  const plan = await resolvePlanForUser(user?.planId, {
    expiresAt: user?.planExpiresAt,
    userId: user?.id,
  });
  const used = (await listProjects(userId)).length;
  const limit = plan.maxPresentations;
  if (used >= limit) {
    throw new PresentationLimitError(used, limit);
  }
}

export async function getUserStorageBytes(userId: string): Promise<number> {
  const projects = await listProjects(userId);
  let total = 0;
  for (const project of projects) {
    total += await projectSizeBytes(project.id);
  }
  return total;
}

function toSnapshot(
  usedBytes: number,
  planLimitMb: number,
  extraMb: number,
): StorageSnapshot {
  const limitBytes = storageLimitBytes(planLimitMb + extraMb);
  return {
    usedBytes,
    extraMb,
    planLimitMb,
    limitBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
  };
}

export async function getStorageSnapshot(userId: string): Promise<StorageSnapshot> {
  const user = await findUserById(userId);
  const plan = await resolvePlanForUser(user?.planId, {
    expiresAt: user?.planExpiresAt,
    userId: user?.id,
  });
  const [usedBytes, usage] = await Promise.all([
    getUserStorageBytes(userId),
    getUserUsage(userId),
  ]);
  return toSnapshot(usedBytes, plan.maxStudents, usage.extraStorageMb);
}

export async function getStorageSnapshots(
  users: PublicUser[],
): Promise<Record<string, StorageSnapshot>> {
  const [projects, plans] = await Promise.all([listProjects(), listPlans()]);
  const usedByOwner = new Map<string, number>();
  for (const project of projects) {
    const owner = project.ownerId?.trim();
    if (!owner) continue;
    usedByOwner.set(
      owner,
      (usedByOwner.get(owner) || 0) + (await projectSizeBytes(project.id)),
    );
  }
  const freePlan =
    plans.find((p) => p.monthlyPrice === 0) || plans[0];
  const plansById = new Map(plans.map((p) => [p.id, p]));
  const out: Record<string, StorageSnapshot> = {};
  for (const user of users) {
    const usage = await getUserUsage(user.id);
    const plan = effectivePlan(user, plansById, freePlan);
    out[user.id] = toSnapshot(
      usedByOwner.get(user.id) || 0,
      plan?.maxStudents || 0,
      usage.extraStorageMb,
    );
  }
  return out;
}

function effectivePlan(
  user: PublicUser,
  plansById: Map<string, SubscriptionPlan>,
  freePlan: SubscriptionPlan | undefined,
): SubscriptionPlan | undefined {
  if (user.planId && !isPlanExpired(user.planExpiresAt)) {
    return plansById.get(user.planId) || freePlan;
  }
  return freePlan;
}

export async function assertStorageAvailable(userId: string, extraBytes = 0) {
  const snapshot = await getStorageSnapshot(userId);
  if (snapshot.usedBytes + extraBytes > snapshot.limitBytes) {
    throw new StorageLimitError(
      snapshot.usedBytes + extraBytes,
      snapshot.limitBytes,
    );
  }
}

export function presentationLimitResponse(err: unknown) {
  if (!(err instanceof PresentationLimitError)) return null;
  return NextResponse.json(
    {
      error: err.message,
      used: err.used,
      limit: err.limit,
      upgradeUrl: "/account/subscription",
    },
    { status: 403 },
  );
}

export function storageLimitResponse(err: unknown) {
  if (!(err instanceof StorageLimitError)) return null;
  return NextResponse.json(
    {
      error: err.message,
      used: err.used,
      limit: err.limit,
      upgradeUrl: "/account/subscription",
    },
    { status: 403 },
  );
}

export function quotaLimitResponse(err: unknown) {
  return presentationLimitResponse(err) || storageLimitResponse(err);
}
