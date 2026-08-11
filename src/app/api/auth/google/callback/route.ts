import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, googleAuthConfigured } from "@/lib/auth/google";
import { appOrigin } from "@/lib/auth/guards";
import {
  attachSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";
import {
  createUser,
  findUserByEmail,
  findUserByGoogleId,
  linkGoogleId,
} from "@/lib/auth/users";
import { sessionPayloadFromUser } from "@/lib/auth/session-user";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const fail = (message: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`,
    );

  if (!googleAuthConfigured()) {
    return fail("Google OAuth chưa được cấu hình.");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Phiên Google không hợp lệ. Thử lại.");
  }

  try {
    const profile = await exchangeGoogleCode(origin, code);
    let user = await findUserByGoogleId(profile.googleId);
    if (!user) {
      const byEmail = await findUserByEmail(profile.email);
      if (byEmail) {
        user = await linkGoogleId(byEmail.id, profile.googleId);
      } else {
        user = await createUser({
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          passwordHash: null,
        });
      }
    }

    if (user.locked) {
      return fail("Tài khoản đã bị khóa. Liên hệ quản trị viên.");
    }

    const payload = await sessionPayloadFromUser(user);
    const token = await createSessionToken(payload);
    const dest = payload.role === "admin" ? "/admin" : "/dashboard";
    const res = NextResponse.redirect(`${origin}${dest}`);
    attachSessionCookie(res, token);
    res.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Đăng nhập Google thất bại");
  }
}
