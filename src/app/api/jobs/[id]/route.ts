import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Không tìm thấy job." }, { status: 404 });
  }
  return NextResponse.json({ job });
}
