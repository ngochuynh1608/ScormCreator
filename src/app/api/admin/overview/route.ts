import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { buildAdminOverview } from "@/lib/admin/overview";
import { parseOverviewRange } from "@/lib/admin/overview-types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const range = parseOverviewRange(req.nextUrl.searchParams.get("range"));
  try {
    const data = await buildAdminOverview(range);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to build admin overview", err);
    return NextResponse.json(
      { error: "Không tải được số liệu tổng quan." },
      { status: 500 },
    );
  }
}
