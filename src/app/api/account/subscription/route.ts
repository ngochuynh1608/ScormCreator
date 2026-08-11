import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { listPlans, getPlan } from "@/lib/auth/plans";
import { getUserUsage } from "@/lib/auth/usage";
import {
  findUserById,
  toPublicUser,
  updateUser,
} from "@/lib/auth/users";
import { listProjects } from "@/lib/db";
import type { SubscriptionPlan } from "@/lib/auth/types";

export const runtime = "nodejs";

async function resolvePlanForUser(
  planId: string | null | undefined,
): Promise<SubscriptionPlan> {
  if (planId) {
    const plan = await getPlan(planId);
    if (plan) return plan;
  }
  const plans = await listPlans();
  const free = plans.find((p) => p.monthlyPrice === 0) || plans[0];
  if (!free) {
    throw new Error("Chưa có gói đăng ký nào được cấu hình.");
  }
  return free;
}

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const user = await findUserById(auth.session.userId);
  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  }

  const plans = await listPlans();
  let plan = await resolvePlanForUser(user.planId);
  // Persist default free plan if unset
  if (!user.planId || user.planId !== plan.id) {
    if (!user.planId) {
      await updateUser(user.id, { planId: plan.id });
      user.planId = plan.id;
    } else {
      plan = (await getPlan(user.planId)) || plan;
    }
  }

  const usage = await getUserUsage(user.id);
  const projects = await listProjects(user.id);

  return NextResponse.json({
    user: toPublicUser(user),
    plan,
    plans,
    usage: {
      presentationsUsed: projects.length,
      presentationsLimit: plan.maxPresentations,
      creditsUsed: usage.creditsUsed,
      creditsLimit: plan.everaiCredits,
      studentsUsed: usage.studentsUsed,
      studentsLimit: plan.maxStudents,
    },
  });
}

const changeSchema = z.object({
  planId: z.string().min(1),
});

/** Switch plan without payment (payment gateway will be added later). */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  try {
    const body = changeSchema.parse(await req.json());
    const plan = await getPlan(body.planId);
    if (!plan) {
      return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });
    }
    const user = await updateUser(auth.session.userId, { planId: plan.id });
    const usage = await getUserUsage(user.id);
    const projects = await listProjects(user.id);
    const plans = await listPlans();

    return NextResponse.json({
      user: toPublicUser(user),
      plan,
      plans,
      usage: {
        presentationsUsed: projects.length,
        presentationsLimit: plan.maxPresentations,
        creditsUsed: usage.creditsUsed,
        creditsLimit: plan.everaiCredits,
        studentsUsed: usage.studentsUsed,
        studentsLimit: plan.maxStudents,
      },
      notice:
        plan.monthlyPrice === 0
          ? "Đã chuyển sang gói miễn phí."
          : "Đã chọn gói. Thanh toán sẽ được bổ sung sau — gói được kích hoạt ngay.",
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
