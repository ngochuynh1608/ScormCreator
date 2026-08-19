import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import type { SubscriptionPlan } from "./types";
import { isPlanExpired, isLowerPlan } from "./plan-expiry";

const DEFAULT_FREE: Omit<SubscriptionPlan, "id" | "createdAt" | "updatedAt"> = {
  name: "Miễn phí",
  maxPresentations: 3,
  everaiCredits: 50,
  maxStudents: 100,
  monthlyPrice: 0,
};

export async function listPlans(): Promise<SubscriptionPlan[]> {
  const store = await getDocumentStore();
  let plans = await store.list<SubscriptionPlan>(COLLECTIONS.plans);
  if (plans.length > 0) {
    return plans.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  }
  const now = new Date().toISOString();
  const seeded: SubscriptionPlan = {
    id: uuidv4(),
    ...DEFAULT_FREE,
    createdAt: now,
    updatedAt: now,
  };
  await store.put(COLLECTIONS.plans, seeded);
  return [seeded];
}

export async function getPlan(id: string): Promise<SubscriptionPlan | null> {
  const store = await getDocumentStore();
  return store.get<SubscriptionPlan>(COLLECTIONS.plans, id);
}

/** Assigned plan, or the cheapest/free plan if unset / missing / expired. */
export async function getFreePlan(): Promise<SubscriptionPlan> {
  const plans = await listPlans();
  const free = plans.find((p) => p.monthlyPrice === 0) || plans[0];
  if (!free) {
    throw new Error("Chưa có gói đăng ký nào được cấu hình.");
  }
  return free;
}

const SIGNUP_SETTINGS_ID = "plans";

type PlanSettingsDoc = { id: string; signupPlanId?: string | null };

export async function getSignupPlanIdSetting(): Promise<string | null> {
  const store = await getDocumentStore();
  const raw = await store.get<PlanSettingsDoc>(
    COLLECTIONS.settings,
    SIGNUP_SETTINGS_ID,
  );
  return raw?.signupPlanId?.trim() || null;
}

export async function setSignupPlanId(planId: string): Promise<string> {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Không tìm thấy gói.");
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.settings, {
    id: SIGNUP_SETTINGS_ID,
    signupPlanId: plan.id,
  });
  return plan.id;
}

export async function clearSignupPlanIdIf(planId: string): Promise<void> {
  const current = await getSignupPlanIdSetting();
  if (current !== planId) return;
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.settings, {
    id: SIGNUP_SETTINGS_ID,
    signupPlanId: null,
  });
}

/** Plan assigned to new accounts (no expiry). Falls back to the free plan. */
export async function getSignupPlan(): Promise<SubscriptionPlan> {
  const id = await getSignupPlanIdSetting();
  if (id) {
    const plan = await getPlan(id);
    if (plan) return plan;
  }
  return getFreePlan();
}

export async function resolvePlanForUser(
  planId: string | null | undefined,
  options?: { expiresAt?: string | null; userId?: string },
): Promise<SubscriptionPlan> {
  const expired = isPlanExpired(options?.expiresAt);
  if (planId && !expired) {
    const plan = await getPlan(planId);
    if (plan) return plan;
  }
  const free = await getFreePlan();
  if (expired && options?.userId) {
    const { updateUser } = await import("./users");
    await updateUser(options.userId, {
      planId: free.id,
      planExpiresAt: null,
    }).catch(() => undefined);
  }
  return free;
}

/**
 * Cannot replace a paid plan with a cheaper one while still assigned that plan.
 * After expiry, resolvePlanForUser already moves the user to the free plan.
 */
export function assertCanSelectPlan(options: {
  current: SubscriptionPlan;
  target: SubscriptionPlan;
  expiresAt?: string | null;
}): void {
  if (options.target.id === options.current.id) return;
  if (isLowerPlan(options.current, options.target)) {
    throw new Error(
      "Gói hiện tại còn hạn sử dụng. Bạn chỉ có thể gia hạn hoặc nâng cấp lên gói cao hơn. Gói thấp hơn sẽ áp dụng khi gói này hết hạn.",
    );
  }
}

export async function createPlan(input: {
  name: string;
  maxPresentations: number;
  everaiCredits: number;
  maxStudents: number;
  monthlyPrice: number;
}): Promise<SubscriptionPlan> {
  const store = await getDocumentStore();
  const now = new Date().toISOString();
  const plan: SubscriptionPlan = {
    id: uuidv4(),
    name: input.name.trim() || "Gói mới",
    maxPresentations: Math.max(0, Math.floor(input.maxPresentations)),
    everaiCredits: Math.max(0, Math.floor(input.everaiCredits)),
    maxStudents: Math.max(0, Math.floor(input.maxStudents)),
    monthlyPrice: Math.max(0, Math.floor(input.monthlyPrice)),
    createdAt: now,
    updatedAt: now,
  };
  await store.put(COLLECTIONS.plans, plan);
  return plan;
}

export async function updatePlan(
  id: string,
  patch: Partial<{
    name: string;
    maxPresentations: number;
    everaiCredits: number;
    maxStudents: number;
    monthlyPrice: number;
  }>,
): Promise<SubscriptionPlan> {
  const store = await getDocumentStore();
  const cur = await store.get<SubscriptionPlan>(COLLECTIONS.plans, id);
  if (!cur) throw new Error("Không tìm thấy gói.");
  const next: SubscriptionPlan = {
    ...cur,
    name:
      typeof patch.name === "string" && patch.name.trim()
        ? patch.name.trim()
        : cur.name,
    maxPresentations:
      patch.maxPresentations != null
        ? Math.max(0, Math.floor(patch.maxPresentations))
        : cur.maxPresentations,
    everaiCredits:
      patch.everaiCredits != null
        ? Math.max(0, Math.floor(patch.everaiCredits))
        : cur.everaiCredits,
    maxStudents:
      patch.maxStudents != null
        ? Math.max(0, Math.floor(patch.maxStudents))
        : cur.maxStudents,
    monthlyPrice:
      patch.monthlyPrice != null
        ? Math.max(0, Math.floor(patch.monthlyPrice))
        : cur.monthlyPrice,
    updatedAt: new Date().toISOString(),
  };
  await store.put(COLLECTIONS.plans, next);
  return next;
}

export async function deletePlan(id: string): Promise<boolean> {
  const store = await getDocumentStore();
  const ok = await store.delete(COLLECTIONS.plans, id);
  if (ok) await clearSignupPlanIdIf(id);
  return ok;
}
