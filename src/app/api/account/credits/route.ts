import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import {
  cancelCreditOrder,
  confirmCreditTransfer,
  createCreditOrder,
  getCreditBankSettings,
  getCreditSnapshot,
  listActiveCreditPacks,
  listCreditOrders,
  listCreditTransactions,
} from "@/lib/credits";
import { isPayosConfigured } from "@/lib/payos/client";
import { syncOwnedOrder } from "@/lib/payos/fulfill";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const userId = auth.session.userId;
  const [wallet, packs, bank, orders, transactions] = await Promise.all([
    getCreditSnapshot(userId),
    listActiveCreditPacks(),
    getCreditBankSettings(),
    listCreditOrders({ userId }),
    listCreditTransactions({ userId }),
  ]);
  return NextResponse.json({
    wallet,
    packs,
    bank: {
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      configured: Boolean(bank.accountNumber && bank.accountName),
    },
    orders,
    transactions,
    payosConfigured: await isPayosConfigured(),
  });
}

const createSchema = z.object({
  packId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  try {
    const body = createSchema.parse(await req.json());
    const order = await createCreditOrder({
      userId: auth.session.userId,
      packId: body.packId,
    });
    const bank = await getCreditBankSettings();
    return NextResponse.json({
      order,
      bank: {
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tạo đơn thất bại" },
      { status: 400 },
    );
  }
}

const patchSchema = z.object({
  orderId: z.string().min(1),
  action: z.enum(["cancel", "confirm-transfer", "sync"]),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    const order =
      body.action === "confirm-transfer"
        ? await confirmCreditTransfer(body.orderId, auth.session.userId)
        : body.action === "sync"
          ? await syncOwnedOrder({
              kind: "credit",
              orderId: body.orderId,
              userId: auth.session.userId,
            })
          : await cancelCreditOrder(body.orderId, auth.session.userId);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Cập nhật đơn thất bại",
      },
      { status: 400 },
    );
  }
}
