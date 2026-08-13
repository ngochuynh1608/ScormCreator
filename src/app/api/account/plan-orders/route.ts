import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { getCreditBankSettings } from "@/lib/credits/settings";
import {
  cancelPlanOrder,
  confirmPlanTransfer,
  createPlanOrder,
  listPlanOrders,
} from "@/lib/subscription/orders";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const orders = await listPlanOrders({ userId: auth.session.userId });
  return NextResponse.json({ orders });
}

const createSchema = z.object({
  planId: z.string().min(1),
  months: z.number().int().min(1).max(24),
});

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  try {
    const body = createSchema.parse(await req.json());
    const order = await createPlanOrder({
      userId: auth.session.userId,
      planId: body.planId,
      months: body.months,
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
  action: z.enum(["cancel", "confirm-transfer"]),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    const order =
      body.action === "confirm-transfer"
        ? await confirmPlanTransfer(body.orderId, auth.session.userId)
        : await cancelPlanOrder(body.orderId, auth.session.userId);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cập nhật đơn thất bại" },
      { status: 400 },
    );
  }
}
