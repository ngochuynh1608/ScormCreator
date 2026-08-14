import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { listPlans, getPlan, resolvePlanForUser, assertCanSelectPlan } from "@/lib/auth/plans";
import { getUserUsage } from "@/lib/auth/usage";
import {
  findUserById,
  toPublicUser,
  updateUser,
} from "@/lib/auth/users";
import { listProjects } from "@/lib/db";
import { getCreditSnapshot } from "@/lib/credits/wallet";
import { getCreditBankSettings } from "@/lib/credits/settings";
import { listPlanOrders } from "@/lib/subscription/orders";
import { isPayosConfigured } from "@/lib/payos/client";
import type { CreditSnapshot } from "@/lib/credits/types";

export const runtime = "nodejs";

function usagePayload(
  presentationsUsed: number,
  presentationsLimit: number,
  studentsUsed: number,
  studentsLimit: number,
  credits: CreditSnapshot,
) {
  return {
    presentationsUsed,
    presentationsLimit,
    creditsUsed: credits.creditsUsed,
    creditsLimit: credits.planLimit,
    creditsExtra: credits.extraCredits,
    creditsReserved: credits.reserved,
    creditsAvailable: credits.available,
    creditsCeiling: credits.ceiling,
    studentsUsed,
    studentsLimit,
  };
}

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const user = await findUserById(auth.session.userId);
  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  }

  const plans = await listPlans();
  let plan = await resolvePlanForUser(user.planId, {
    expiresAt: user.planExpiresAt,
    userId: user.id,
  });
  const fresh = await findUserById(user.id);
  if (fresh) {
    user.planId = fresh.planId;
    user.planExpiresAt = fresh.planExpiresAt;
  }
  if (!user.planId || user.planId !== plan.id) {
    if (!user.planId) {
      await updateUser(user.id, { planId: plan.id, planExpiresAt: null });
      user.planId = plan.id;
      user.planExpiresAt = null;
    }
  }

  const usage = await getUserUsage(user.id);
  const credits = await getCreditSnapshot(user.id);
  const projects = await listProjects(user.id);
  const bank = await getCreditBankSettings();
  const planOrders = await listPlanOrders({ userId: user.id });

  return NextResponse.json({
    user: toPublicUser(user),
    plan,
    plans,
    planExpiresAt: user.planExpiresAt || null,
    bank: {
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      configured: Boolean(bank.accountNumber && bank.accountName),
    },
    planOrders,
    payosConfigured: await isPayosConfigured(),
    usage: usagePayload(
      projects.length,
      plan.maxPresentations,
      usage.studentsUsed,
      plan.maxStudents,
      credits,
    ),
  });
}

const changeSchema = z.object({
  planId: z.string().min(1),
});

/** Immediate switch is only allowed for the free plan. Paid plans go through transfer orders. */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  try {
    const body = changeSchema.parse(await req.json());
    const plan = await getPlan(body.planId);
    if (!plan) {
      return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });
    }
    if (plan.monthlyPrice > 0) {
      return NextResponse.json(
        {
          error:
            "Gói trả phí cần thanh toán qua PayOS. Dùng luồng nâng cấp gói.",
        },
        { status: 400 },
      );
    }
    const user = await findUserById(auth.session.userId);
    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
    }
    const current = await resolvePlanForUser(user.planId, {
      expiresAt: user.planExpiresAt,
      userId: user.id,
    });
    const fresh = await findUserById(user.id);
    try {
      assertCanSelectPlan({
        current,
        target: plan,
        expiresAt: fresh?.planExpiresAt ?? user.planExpiresAt,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Không thể hạ gói." },
        { status: 400 },
      );
    }
    const nextUser = await updateUser(auth.session.userId, {
      planId: plan.id,
      planExpiresAt: null,
    });
    const usage = await getUserUsage(nextUser.id);
    const credits = await getCreditSnapshot(nextUser.id);
    const projects = await listProjects(nextUser.id);
    const plans = await listPlans();

    return NextResponse.json({
      user: toPublicUser(nextUser),
      plan,
      plans,
      planExpiresAt: null,
      usage: usagePayload(
        projects.length,
        plan.maxPresentations,
        usage.studentsUsed,
        plan.maxStudents,
        credits,
      ),
      notice: "Đã chuyển sang gói miễn phí.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Đổi gói thất bại" },
      { status: 500 },
    );
  }
}
