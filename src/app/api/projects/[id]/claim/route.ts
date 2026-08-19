import { NextRequest, NextResponse } from "next/server";
import {
  claimGuestProject,
  clearGuestClaimCookie,
  guestCookieName,
} from "@/lib/auth/guest";
import { requireSession } from "@/lib/auth/guards";
import { assertCanCreatePresentation, assertStorageAvailable, quotaLimitResponse } from "@/lib/auth/quota";
import { getProject } from "@/lib/db";
import { projectSizeBytes } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Attach current session user as owner of a guest draft. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const token = req.cookies.get(guestCookieName(id))?.value || null;
  try {
    const existing = await getProject(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy dự án." },
        { status: 404 },
      );
    }
    if (existing.ownerId !== auth.session.userId) {
      await assertCanCreatePresentation(auth.session.userId);
      await assertStorageAvailable(
        auth.session.userId,
        await projectSizeBytes(id),
      );
    }
    const project = await claimGuestProject(id, auth.session.userId, token);
    if (!project) {
      return NextResponse.json(
        { error: "Không tìm thấy dự án." },
        { status: 404 },
      );
    }
    const res = NextResponse.json({
      project: {
        ...project,
        guestClaimToken: undefined,
      },
      claimed: true,
    });
    clearGuestClaimCookie(res, id);
    return res;
  } catch (err) {
    const limited = quotaLimitResponse(err);
    if (limited) return limited;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nhận dự án thất bại" },
      { status: 403 },
    );
  }
}
