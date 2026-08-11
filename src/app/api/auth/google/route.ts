import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  googleAuthConfigured,
  googleAuthorizeUrl,
} from "@/lib/auth/google";
import { appOrigin } from "@/lib/auth/guards";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!googleAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình Google OAuth. Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.",
      },
      { status: 400 },
    );
  }
  const origin = appOrigin(req);
  const state = randomUUID();
  const res = NextResponse.redirect(googleAuthorizeUrl(origin, state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
