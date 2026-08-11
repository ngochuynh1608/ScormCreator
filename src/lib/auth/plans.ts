import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import type { SubscriptionPlan } from "./types";

const DEFAULT_FREE: Omit<SubscriptionPlan, "id" | "createdAt" | "updatedAt"> = {
  name: "Miễn phí",
  maxPresentations: 3,
  everaiCredits: 50,
  maxStudents: 10,
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
  return store.delete(COLLECTIONS.plans, id);
}
