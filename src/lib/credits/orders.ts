import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import { addExtraCredits } from "../auth/usage";
import {
  cancelPaymentLink,
  createPaymentLink,
  getPaymentLink,
  isPayosConfigured,
} from "../payos/client";
import { getCreditPack } from "./packs";
import { getCreditBankSettings, renderTransferContent } from "./settings";
import { recordCreditTransaction } from "./transactions";
import type { CreditOrder, CreditOrderStatus } from "./types";
import { withCreditLock } from "./wallet";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeOrderCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

async function listAllOrders(): Promise<CreditOrder[]> {
  const store = await getDocumentStore();
  return store.list<CreditOrder>(COLLECTIONS.creditOrders);
}

export async function listCreditOrders(options?: {
  userId?: string;
  status?: CreditOrderStatus;
}): Promise<CreditOrder[]> {
  let rows = await listAllOrders();
  if (options?.userId) {
    rows = rows.filter((r) => r.userId === options.userId);
  }
  if (options?.status) {
    rows = rows.filter((r) => r.status === options.status);
  }
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getCreditOrder(id: string): Promise<CreditOrder | null> {
  const store = await getDocumentStore();
  return store.get<CreditOrder>(COLLECTIONS.creditOrders, id);
}

export async function getCreditOrderByPayosCode(
  code: number,
): Promise<CreditOrder | null> {
  const rows = await listAllOrders();
  return rows.find((o) => o.payosOrderCode === code) || null;
}

async function uniqueOrderCode(): Promise<string> {
  const existing = new Set((await listAllOrders()).map((o) => o.orderCode));
  for (let i = 0; i < 12; i++) {
    const code = makeOrderCode();
    if (!existing.has(code)) return code;
  }
  return `${makeOrderCode()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

export async function createCreditOrder(input: {
  userId: string;
  packId: string;
}): Promise<CreditOrder> {
  const pack = await getCreditPack(input.packId);
  if (!pack || !pack.active) {
    throw new Error("Gói credit không còn được bán.");
  }
  if (!(await isPayosConfigured())) {
    throw new Error(
      "Thanh toán PayOS chưa được cấu hình. Liên hệ quản trị để nạp credit.",
    );
  }
  const bank = await getCreditBankSettings();
  const orderCode = await uniqueOrderCode();
  const now = new Date().toISOString();
  const orderId = uuidv4();
  const payos = await createPaymentLink({
    kind: "credit",
    orderId,
    orderCode,
    amount: pack.priceVnd,
    itemName: pack.name,
  });
  const order: CreditOrder = {
    id: orderId,
    orderCode,
    userId: input.userId,
    packId: pack.id,
    packName: pack.name,
    credits: pack.credits,
    priceVnd: pack.priceVnd,
    status: "pending",
    transferContent: renderTransferContent(bank.transferNoteTemplate, orderCode),
    createdAt: now,
    updatedAt: now,
    ...payos,
  };
  const store = await getDocumentStore();
  try {
    await store.put(COLLECTIONS.creditOrders, order);
  } catch (err) {
    try {
      await cancelPaymentLink(payos.payosOrderCode);
    } catch {
      // ignore
    }
    throw err;
  }
  return order;
}

export async function confirmCreditTransfer(
  orderId: string,
  userId: string,
): Promise<CreditOrder> {
  const order = await getCreditOrder(orderId);
  if (!order || order.userId !== userId) {
    throw new Error("Không tìm thấy đơn nạp.");
  }
  if (order.status !== "pending") {
    throw new Error("Đơn này không còn chờ xác nhận.");
  }
  const now = new Date().toISOString();
  const next: CreditOrder = {
    ...order,
    transferConfirmedAt: order.transferConfirmedAt || now,
    updatedAt: now,
  };
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.creditOrders, next);
  return next;
}

export async function cancelCreditOrder(
  orderId: string,
  userId: string,
): Promise<CreditOrder> {
  const order = await getCreditOrder(orderId);
  if (!order || order.userId !== userId) {
    throw new Error("Không tìm thấy đơn nạp.");
  }
  if (order.status !== "pending") {
    throw new Error("Chỉ hủy được đơn đang chờ xác nhận.");
  }
  if (order.payosOrderCode && (await isPayosConfigured())) {
    try {
      const info = await getPaymentLink(order.payosOrderCode);
      if (info.status === "PAID") {
        try {
          return await reviewCreditOrder({
            orderId: order.id,
            action: "confirm",
            adminUserId: "payos",
            payosReference: info.transactions?.[0]?.reference,
          });
        } catch (err) {
          const fresh = await getCreditOrder(order.id);
          if (fresh?.status === "paid") return fresh;
          throw err;
        }
      }
      if (
        info.status === "PENDING" ||
        info.status === "PROCESSING" ||
        info.status === "UNDERPAID"
      ) {
        try {
          await cancelPaymentLink(order.payosOrderCode);
        } catch {
          // already cancelled on PayOS
        }
      }
    } catch {
      try {
        await cancelPaymentLink(order.payosOrderCode);
      } catch {
        // ignore PayOS cancel errors and still close locally
      }
    }
  }
  return markCreditOrderCancelled(order.id);
}

export async function markCreditOrderCancelled(
  orderId: string,
): Promise<CreditOrder> {
  const order = await getCreditOrder(orderId);
  if (!order) throw new Error("Không tìm thấy đơn nạp.");
  if (order.status === "cancelled") return order;
  if (order.status !== "pending") {
    throw new Error("Chỉ hủy được đơn đang chờ xác nhận.");
  }
  const next: CreditOrder = {
    ...order,
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  };
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.creditOrders, next);
  return next;
}

export async function reviewCreditOrder(input: {
  orderId: string;
  action: "confirm" | "reject";
  adminUserId: string;
  note?: string;
  payosReference?: string;
}): Promise<CreditOrder> {
  return withCreditLock(async () => {
    const order = await getCreditOrder(input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn nạp.");
    if (order.status !== "pending") {
      throw new Error("Đơn này đã được xử lý.");
    }
    const now = new Date().toISOString();
    const payosReference = input.payosReference || order.payosReference;
    if (input.action === "reject") {
      const next: CreditOrder = {
        ...order,
        status: "rejected",
        note: input.note?.trim() || order.note,
        reviewedAt: now,
        reviewedBy: input.adminUserId,
        payosReference,
        updatedAt: now,
      };
      const store = await getDocumentStore();
      await store.put(COLLECTIONS.creditOrders, next);
      return next;
    }

    const usage = await addExtraCredits(order.userId, order.credits);
    await recordCreditTransaction({
      userId: order.userId,
      type: "purchase",
      amount: order.credits,
      extraCreditsAfter: usage.extraCredits,
      creditsUsedAfter: usage.creditsUsed,
      orderId: order.id,
      note: `Nạp gói ${order.packName} (${order.orderCode})`,
    });
    const next: CreditOrder = {
      ...order,
      status: "paid",
      note: input.note?.trim() || order.note,
      reviewedAt: now,
      reviewedBy: input.adminUserId,
      payosReference,
      updatedAt: now,
    };
    const store = await getDocumentStore();
    await store.put(COLLECTIONS.creditOrders, next);
    return next;
  });
}
