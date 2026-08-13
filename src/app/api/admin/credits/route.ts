import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { listUsers } from "@/lib/auth/users";
import {
  createCreditPack,
  deleteCreditPack,
  getCreditBankSettings,
  grantCredits,
  listCreditOrders,
  listCreditPacks,
  reviewCreditOrder,
  saveCreditBankSettings,
  updateCreditPack,
} from "@/lib/credits";
import { listPlanOrders, reviewPlanOrder } from "@/lib/subscription/orders";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const [packs, bank, orders, planOrders, users] = await Promise.all([
    listCreditPacks(),
    getCreditBankSettings(),
    listCreditOrders(),
    listPlanOrders(),
    listUsers(),
  ]);
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return NextResponse.json({
    packs,
    bank,
    orders: orders.map((o) => ({
      ...o,
      userEmail: byId[o.userId]?.email || o.userId,
      userName: byId[o.userId]?.name || "",
    })),
    planOrders: planOrders.map((o) => ({
      ...o,
      userEmail: byId[o.userId]?.email || o.userId,
      userName: byId[o.userId]?.name || "",
    })),
  });
}

const packSchema = z.object({
  name: z.string().trim().min(1).max(80),
  credits: z.number().int().min(1).max(100_000_000),
  priceVnd: z.number().int().min(0).max(100_000_000_000),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
});

const bankSchema = z.object({
  bankName: z.string().trim().max(120),
  accountNumber: z.string().trim().max(40),
  accountName: z.string().trim().max(120),
  transferNoteTemplate: z.string().trim().max(80).optional(),
});

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pack"), ...packSchema.shape }),
  z.object({ kind: z.literal("bank"), ...bankSchema.shape }),
  z.object({
    kind: z.literal("grant"),
    userId: z.string().min(1),
    amount: z.number().int().min(1).max(100_000_000),
    note: z.string().trim().max(200).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = bodySchema.parse(await req.json());
    if (body.kind === "pack") {
      const pack = await createCreditPack(body);
      return NextResponse.json({ pack });
    }
    if (body.kind === "bank") {
      const bank = await saveCreditBankSettings(body);
      return NextResponse.json({ bank });
    }
    const wallet = await grantCredits({
      userId: body.userId,
      amount: body.amount,
      adminUserId: auth.session.userId,
      note: body.note,
    });
    return NextResponse.json({ wallet });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Thao tác thất bại" },
      { status: 400 },
    );
  }
}

const patchSchema = z.discriminatedUnion("kind", [
  packSchema.partial().extend({
    kind: z.literal("pack"),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal("order"),
    id: z.string().min(1),
    action: z.enum(["confirm", "reject"]),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    kind: z.literal("plan-order"),
    id: z.string().min(1),
    action: z.enum(["confirm", "reject"]),
    note: z.string().trim().max(200).optional(),
  }),
]);

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    if (body.kind === "pack") {
      const pack = await updateCreditPack(body.id, {
        name: body.name,
        credits: body.credits,
        priceVnd: body.priceVnd,
        active: body.active,
        sortOrder: body.sortOrder,
      });
      return NextResponse.json({ pack });
    }
    if (body.kind === "plan-order") {
      const order = await reviewPlanOrder({
        orderId: body.id,
        action: body.action,
        adminUserId: auth.session.userId,
        note: body.note,
      });
      return NextResponse.json({ planOrder: order });
    }
    const order = await reviewCreditOrder({
      orderId: body.id,
      action: body.action,
      adminUserId: auth.session.userId,
      note: body.note,
    });
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cập nhật thất bại" },
      { status: 400 },
    );
  }
}

const deleteSchema = z.object({
  kind: z.literal("pack"),
  id: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = deleteSchema.parse(await req.json());
    const ok = await deleteCreditPack(body.id);
    if (!ok) {
      return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xóa thất bại" },
      { status: 400 },
    );
  }
}
