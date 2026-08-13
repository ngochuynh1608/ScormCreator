import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createPlan,
  deletePlan,
  getSignupPlan,
  listPlans,
  setSignupPlanId,
  updatePlan,
} from "@/lib/auth/plans";
import { listUsers, updateUser } from "@/lib/auth/users";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const [plans, signup] = await Promise.all([listPlans(), getSignupPlan()]);
  return NextResponse.json({ plans, signupPlanId: signup.id });
}

const planBody = z.object({
  name: z.string().trim().min(1).max(80),
  maxPresentations: z.number().int().min(0).max(1_000_000),
  everaiCredits: z.number().int().min(0).max(100_000_000),
  maxStudents: z.number().int().min(0).max(1_000_000),
  monthlyPrice: z.number().int().min(0).max(100_000_000_000),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = planBody.parse(await req.json());
    const plan = await createPlan(body);
    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tạo gói thất bại" },
      { status: 500 },
    );
  }
}

const patchSchema = planBody.partial().extend({
  id: z.string().min(1).optional(),
  signupPlanId: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    if (body.signupPlanId && !body.id) {
      const signupPlanId = await setSignupPlanId(body.signupPlanId);
      return NextResponse.json({ signupPlanId });
    }
    if (!body.id) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    const { id, signupPlanId: _signup, ...patch } = body;
    const plan = await updatePlan(id, patch);
    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cập nhật thất bại" },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = deleteSchema.parse(await req.json());
    const ok = await deletePlan(body.id);
    if (!ok) {
      return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });
    }
    // Unassign users from deleted plan
    const users = await listUsers();
    for (const u of users) {
      if (u.planId === body.id) {
        await updateUser(u.id, { planId: null });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xóa thất bại" },
      { status: 500 },
    );
  }
}
