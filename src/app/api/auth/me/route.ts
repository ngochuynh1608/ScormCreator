import { NextResponse } from "next/server";
import { ensureDefaultAdmin } from "@/lib/auth/ensure-admin";
import { googleAuthConfigured } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";
import { findUserById, toPublicUser } from "@/lib/auth/users";

export const runtime = "nodejs";

export async function GET() {
  await ensureDefaultAdmin();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      user: null,
      googleEnabled: googleAuthConfigured(),
    });
  }
  const user = await findUserById(session.userId);
  if (!user) {
    return NextResponse.json({
      user: null,
      googleEnabled: googleAuthConfigured(),
    });
  }
  return NextResponse.json({
    user: toPublicUser(user),
    googleEnabled: googleAuthConfigured(),
  });
}
