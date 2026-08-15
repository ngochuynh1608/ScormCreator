import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";
import { findUserByEmail, isEmailVerified, toPublicUser } from "@/lib/auth/users";
import { sessionPayloadFromUser } from "@/lib/auth/session-user";
import { ensureDefaultAdmin } from "@/lib/auth/ensure-admin";
import { requestOtpAction } from "@/lib/auth/email-otp";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(100),
});

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAdmin();
    const body = schema.parse(await req.json());
    const user = await findUserByEmail(body.email);
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không đúng." },
        { status: 401 },
      );
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không đúng." },
        { status: 401 },
      );
    }
    if (user.locked) {
      return NextResponse.json(
        { error: "Tài khoản đã bị khóa. Liên hệ quản trị viên." },
        { status: 403 },
      );
    }
    if (!isEmailVerified(user)) {
      await requestOtpAction({ email: body.email }, { ip: clientIp(req) });
      return NextResponse.json(
        {
          error: "Tài khoản chưa xác thực email. Nhập mã OTP đã gửi đến hộp thư.",
          needsVerification: true,
        },
        { status: 403 },
      );
    }
    const token = await createSessionToken(await sessionPayloadFromUser(user));
    const res = NextResponse.json({ user: toPublicUser(user) });
    return attachSessionCookie(res, token);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Thông tin đăng nhập không hợp lệ." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Đăng nhập thất bại" },
      { status: 500 },
    );
  }
}
