import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import { getPlan } from "../auth/plans";
import { findUserById, updateUser } from "../auth/users";
import { getCreditBankSettings } from "../credits/settings";
import { withCreditLock } from "../credits/wallet";
import { isPlanExpired, planExpiryFromMonths } from "../auth/plan-expiry";
import type { PlanOrder, PlanOrderStatus } from "./types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeOrderCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

async function listAll(): Promise<PlanOrder[]> {
  const store = await getDocumentStore();
  return store.list<PlanOrder>(COLLECTIONS.planOrders);
}

export async function listPlanOrders(options?: {
  userId?: string;
  status?: PlanOrderStatus;
}): Promise<PlanOrder[]> {
  let rows = await listAll();
  if (options?.userId) rows = rows.filter((r) => r.userId === options.userId);
  if (options?.status) rows = rows.filter((r) => r.status === options.status);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPlanOrder(id: string): Promise<PlanOrder | null> {
  const store = await getDocumentStore();
  return store.get<PlanOrder>(COLLECTIONS.planOrders, id);
}

async function uniqueOrderCode(): Promise<string> {
  const existing = new Set((await listAll()).map((o) => o.orderCode));
  for (let i = 0; i < 12; i++) {
    const code = makeOrderCode();
    if (!existing.has(code)) return code;
  }
  return `${makeOrderCode()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

export async function createPlanOrder(input: {
  userId: string;
  planId: string;
  months: number;
}): Promise<PlanOrder> {
  const months = Math.floor(input.months);
  if (months < 1 || months > 24) {
    throw new Error("Số tháng phải từ 1 đến 24.");
  }
  const plan = await getPlan(input.planId);
  if (!plan) throw new Error("Không tìm thấy gói.");
  if (plan.monthlyPrice <= 0) {
    throw new Error("Gói miễn phí không cần thanh toán.");
  }
  const bank = await getCreditBankSettings();
  if (!bank.accountNumber || !bank.accountName) {
    throw new Error(
      "Admin chưa cấu hình tài khoản ngân hàng. Liên hệ quản trị để nâng cấp gói.",
    );
  }
  const orderCode = await uniqueOrderCode();
  const now = new Date().toISOString();
  const order: PlanOrder = {
    id: uuidv4(),
    orderCode,
    userId: input.userId,
    planId: plan.id,
    planName: plan.name,
    months,
    monthlyPrice: plan.monthlyPrice,
    priceVnd: plan.monthlyPrice * months,
    status: "pending",
    transferContent: `GOI ${orderCode}`,
    createdAt: now,
    updatedAt: now,
  };
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.planOrders, order);
  return order;
}

export async function confirmPlanTransfer(
  orderId: string,
  userId: string,
): Promise<PlanOrder> {
  const order = await getPlanOrder(orderId);
  if (!order || order.userId !== userId) {
    throw new Error("Không tìm thấy đơn nâng cấp.");
  }
  if (order.status !== "pending") {
    throw new Error("Đơn này không còn chờ xác nhận.");
  }
  const now = new Date().toISOString();
  const next: PlanOrder = {
    ...order,
    transferConfirmedAt: order.transferConfirmedAt || now,
    updatedAt: now,
  };
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.planOrders, next);
  return next;
}

export async function cancelPlanOrder(
  orderId: string,
  userId: string,
): Promise<PlanOrder> {
  const order = await getPlanOrder(orderId);
  if (!order || order.userId !== userId) {
    throw new Error("Không tìm thấy đơn nâng cấp.");
  }
  if (order.status !== "pending") {
    throw new Error("Chỉ hủy được đơn đang chờ xác nhận.");
  }
  const next: PlanOrder = {
    ...order,
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  };
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.planOrders, next);
  return next;
}

export async function reviewPlanOrder(input: {
  orderId: string;
  action: "confirm" | "reject";
  adminUserId: string;
  note?: string;
}): Promise<PlanOrder> {
  return withCreditLock(async () => {
    const order = await getPlanOrder(input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn nâng cấp.");
    if (order.status !== "pending") {
      throw new Error("Đơn này đã được xử lý.");
    }
    const now = new Date().toISOString();
    if (input.action === "reject") {
      const next: PlanOrder = {
        ...order,
        status: "rejected",
        note: input.note?.trim() || order.note,
        reviewedAt: now,
        reviewedBy: input.adminUserId,
        updatedAt: now,
      };
      const store = await getDocumentStore();
      await store.put(COLLECTIONS.planOrders, next);
      return next;
    }

    const user = await findUserById(order.userId);
    const base =
      user?.planId === order.planId &&
      user.planExpiresAt &&
      !isPlanExpired(user.planExpiresAt)
        ? user.planExpiresAt
        : now;
    const expiresAt = planExpiryFromMonths(base, order.months);
    await updateUser(order.userId, {
      planId: order.planId,
      planExpiresAt: expiresAt,
    });
    const next: PlanOrder = {
      ...order,
      status: "paid",
      expiresAt,
      note: input.note?.trim() || order.note,
      reviewedAt: now,
      reviewedBy: input.adminUserId,
      updatedAt: now,
    };
    const store = await getDocumentStore();
    await store.put(COLLECTIONS.planOrders, next);
    return next;
  });
}
