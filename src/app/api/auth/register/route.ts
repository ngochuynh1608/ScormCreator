import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";
import { createUser, findUserByEmail, toPublicUser } from "@/lib/auth/users";
import { sessionPayloadFromUser } from "@/lib/auth/session-user";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const existing = await findUserByEmail(body.email);
    if (existing) {
      return NextResponse.json(
        { error: "Email đã được sử dụng." },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      email: body.email,
      name: body.name,
      passwordHash,
    });
    const token = await createSessionToken(await sessionPayloadFromUser(user));
    const res = NextResponse.json({ user: toPublicUser(user) });
    return attachSessionCookie(res, token);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Thông tin đăng ký không hợp lệ." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Đăng ký thất bại" },
      { status: 500 },
    );
  }
}
