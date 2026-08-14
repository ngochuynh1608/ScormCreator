import type { PaymentLink } from "@payos/node";
import {
  getCreditOrder,
  getCreditOrderByPayosCode,
  markCreditOrderCancelled,
  reviewCreditOrder,
} from "../credits/orders";
import type { CreditOrder } from "../credits/types";
import {
  getPlanOrder,
  getPlanOrderByPayosCode,
  markPlanOrderCancelled,
  reviewPlanOrder,
} from "../subscription/orders";
import type { PlanOrder } from "../subscription/types";
import { getPaymentLink, isPayosConfigured } from "./client";

export type PayosOrderKind = "credit" | "plan";

export type FulfillResult =
  | { kind: "credit"; order: CreditOrder; outcome: "paid" | "cancelled" | "ignored" }
  | { kind: "plan"; order: PlanOrder; outcome: "paid" | "cancelled" | "ignored" }
  | { kind: null; order: null; outcome: "not_found" | "amount_mismatch" };

async function confirmCreditPaid(
  order: CreditOrder,
  reference?: string,
): Promise<CreditOrder> {
  try {
    return await reviewCreditOrder({
      orderId: order.id,
      action: "confirm",
      adminUserId: "payos",
      payosReference: reference,
    });
  } catch (err) {
    const fresh = await getCreditOrder(order.id);
    if (fresh?.status === "paid") return fresh;
    throw err;
  }
}

async function confirmPlanPaid(
  order: PlanOrder,
  reference?: string,
): Promise<PlanOrder> {
  try {
    return await reviewPlanOrder({
      orderId: order.id,
      action: "confirm",
      adminUserId: "payos",
      payosReference: reference,
    });
  } catch (err) {
    const fresh = await getPlanOrder(order.id);
    if (fresh?.status === "paid") return fresh;
    throw err;
  }
}

export async function fulfillPayosWebhook(input: {
  payosOrderCode: number;
  amount: number;
  reference?: string;
  paid: boolean;
}): Promise<FulfillResult> {
  const credit = await getCreditOrderByPayosCode(input.payosOrderCode);
  const plan = credit
    ? null
    : await getPlanOrderByPayosCode(input.payosOrderCode);
  const found = credit
    ? ({ kind: "credit" as const, order: credit })
    : plan
      ? ({ kind: "plan" as const, order: plan })
      : null;
  if (!found) {
    return { kind: null, order: null, outcome: "not_found" };
  }
  if (found.order.status === "paid" || found.order.status === "cancelled") {
    return { ...found, outcome: found.order.status === "paid" ? "paid" : "cancelled" };
  }
  if (found.order.status !== "pending") {
    return { ...found, outcome: "ignored" };
  }
  if (!input.paid) {
    return { ...found, outcome: "ignored" };
  }
  if (found.order.priceVnd !== input.amount) {
    return { kind: null, order: null, outcome: "amount_mismatch" };
  }
  if (found.kind === "credit") {
    const order = await confirmCreditPaid(found.order, input.reference);
    return { kind: "credit", order, outcome: "paid" };
  }
  const order = await confirmPlanPaid(found.order, input.reference);
  return { kind: "plan", order, outcome: "paid" };
}

function referenceFromLink(info: PaymentLink): string | undefined {
  return info.transactions?.find((t) => t.reference)?.reference;
}

export async function syncOwnedOrder(input: {
  kind: PayosOrderKind;
  orderId: string;
  userId: string;
}): Promise<CreditOrder | PlanOrder> {
  if (input.kind === "credit") {
    const order = await getCreditOrder(input.orderId);
    if (!order || order.userId !== input.userId) {
      throw new Error("Không tìm thấy đơn nạp.");
    }
    return syncCreditOrder(order);
  }
  const order = await getPlanOrder(input.orderId);
  if (!order || order.userId !== input.userId) {
    throw new Error("Không tìm thấy đơn nâng cấp.");
  }
  return syncPlanOrder(order);
}

async function syncCreditOrder(order: CreditOrder): Promise<CreditOrder> {
  if (order.status !== "pending" || !order.payosOrderCode) return order;
  if (!(await isPayosConfigured())) return order;
  const info = await getPaymentLink(order.payosOrderCode);
  if (info.status === "PAID") {
    if (info.amount !== order.priceVnd && info.amountPaid < order.priceVnd) {
      return order;
    }
    return confirmCreditPaid(order, referenceFromLink(info));
  }
  if (info.status === "CANCELLED" || info.status === "EXPIRED" || info.status === "FAILED") {
    return markCreditOrderCancelled(order.id);
  }
  return order;
}

async function syncPlanOrder(order: PlanOrder): Promise<PlanOrder> {
  if (order.status !== "pending" || !order.payosOrderCode) return order;
  if (!(await isPayosConfigured())) return order;
  const info = await getPaymentLink(order.payosOrderCode);
  if (info.status === "PAID") {
    if (info.amount !== order.priceVnd && info.amountPaid < order.priceVnd) {
      return order;
    }
    return confirmPlanPaid(order, referenceFromLink(info));
  }
  if (info.status === "CANCELLED" || info.status === "EXPIRED" || info.status === "FAILED") {
    return markPlanOrderCancelled(order.id);
  }
  return order;
}
