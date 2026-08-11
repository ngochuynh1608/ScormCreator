import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";
import { findUserByEmail, toPublicUser } from "@/lib/auth/users";
import { sessionPayloadFromUser } from "@/lib/auth/session-user";
import { ensureDefaultAdmin } from "@/lib/auth/ensure-admin";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(100),
});

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
