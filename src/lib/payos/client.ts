import { PayOS } from "@payos/node";
import type { PaymentLink, Webhook, WebhookData } from "@payos/node";
import { COLLECTIONS, getDocumentStore } from "../store";
import { resolvePayosSettings } from "./settings";

export type PayosLinkFields = {
  payosOrderCode: number;
  paymentLinkId: string;
  checkoutUrl: string;
  qrCode?: string;
  payosBin?: string;
  payosAccountNumber?: string;
  payosAccountName?: string;
  payosDescription?: string;
};

export async function isPayosConfigured(): Promise<boolean> {
  const creds = await resolvePayosSettings();
  return Boolean(creds.clientId && creds.apiKey && creds.checksumKey);
}

export async function payosReturnBaseUrl(): Promise<string> {
  const creds = await resolvePayosSettings();
  return creds.returnBaseUrl;
}

export async function getPayos(): Promise<PayOS> {
  const creds = await resolvePayosSettings();
  if (!creds.clientId || !creds.apiKey || !creds.checksumKey) {
    throw new Error("PayOS chưa được cấu hình. Liên hệ quản trị.");
  }
  return new PayOS({
    clientId: creds.clientId,
    apiKey: creds.apiKey,
    checksumKey: creds.checksumKey,
  });
}

function makePayosOrderCode(): number {
  const time = Date.now() % 1_000_000_000;
  const rand = Math.floor(Math.random() * 1000);
  return time * 1000 + rand;
}

async function usedPayosOrderCodes(): Promise<Set<number>> {
  const store = await getDocumentStore();
  const [credits, plans] = await Promise.all([
    store.list<{ id: string; payosOrderCode?: number }>(COLLECTIONS.creditOrders),
    store.list<{ id: string; payosOrderCode?: number }>(COLLECTIONS.planOrders),
  ]);
  const used = new Set<number>();
  for (const row of credits) {
    if (row.payosOrderCode) used.add(row.payosOrderCode);
  }
  for (const row of plans) {
    if (row.payosOrderCode) used.add(row.payosOrderCode);
  }
  return used;
}

export async function uniquePayosOrderCode(): Promise<number> {
  const used = await usedPayosOrderCodes();
  for (let i = 0; i < 16; i++) {
    const code = makePayosOrderCode();
    if (code > 0 && !used.has(code)) return code;
  }
  throw new Error("Không tạo được mã thanh toán. Thử lại.");
}

/** PayOS description max 9 chars when the bank account is not linked. */
export function payosDescription(
  kind: "credit" | "plan",
  orderCode: string,
): string {
  const short =
    orderCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase() || "ORDER";
  const prefix = kind === "credit" ? "NAP" : "GOI";
  return `${prefix} ${short}`.slice(0, 9);
}

export async function createPaymentLink(input: {
  kind: "credit" | "plan";
  orderId: string;
  orderCode: string;
  amount: number;
  itemName: string;
}): Promise<PayosLinkFields> {
  const payos = await getPayos();
  const base = await payosReturnBaseUrl();
  const path =
    input.kind === "credit" ? "/account/payments" : "/account/subscription";
  const returnUrl = `${base}${path}?orderId=${encodeURIComponent(input.orderId)}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const orderCode = await uniquePayosOrderCode();
    try {
      const link = await payos.paymentRequests.create({
        orderCode,
        amount: input.amount,
        description: payosDescription(input.kind, input.orderCode),
        returnUrl,
        cancelUrl: returnUrl,
        expiredAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        items: [
          {
            name: input.itemName.slice(0, 25) || "Don hang",
            quantity: 1,
            price: input.amount,
          },
        ],
      });
      return {
        payosOrderCode: link.orderCode,
        paymentLinkId: link.paymentLinkId,
        checkoutUrl: link.checkoutUrl,
        qrCode: link.qrCode || undefined,
        payosBin: link.bin || undefined,
        payosAccountNumber: link.accountNumber || undefined,
        payosAccountName: link.accountName || undefined,
        payosDescription: link.description || undefined,
      };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/tồn tại|exist/i.test(msg) && attempt < 2) continue;
      throw new Error(
        err instanceof Error
          ? err.message
          : "Không tạo được link thanh toán PayOS.",
      );
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Không tạo được link thanh toán PayOS.");
}

export async function verifyWebhook(body: unknown): Promise<WebhookData> {
  const webhook = body as Webhook;
  return (await getPayos()).webhooks.verify(webhook);
}

export async function getPaymentLink(
  orderCode: number,
): Promise<PaymentLink> {
  return (await getPayos()).paymentRequests.get(orderCode);
}

export async function cancelPaymentLink(orderCode: number): Promise<void> {
  if (!(await isPayosConfigured())) return;
  await (await getPayos()).paymentRequests.cancel(orderCode, "Huy don");
}
