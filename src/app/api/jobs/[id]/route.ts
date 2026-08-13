import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth/guest";
import { getJob } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Không tìm thấy job." }, { status: 404 });
  }
  const access = await requireProjectAccess(req, job.projectId);
  if (access.error) return access.error;
  return NextResponse.json({ job });
}
