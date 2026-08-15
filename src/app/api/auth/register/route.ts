import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { requestOtpAction } from "@/lib/auth/email-otp";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
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
    const body = schema.parse(await req.json());
    const existing = await findUserByEmail(body.email);
    if (existing) {
      return NextResponse.json(
        { error: "Email đã được sử dụng." },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(body.password);
    await createUser({
      email: body.email,
      name: body.name,
      passwordHash,
      emailVerifiedAt: null,
    });
    const otp = await requestOtpAction(
      { email: body.email },
      { ip: clientIp(req) },
    );
    return NextResponse.json({
      needsVerification: true,
      sent: otp.status === 200 && otp.body.success === true,
      message:
        typeof otp.body.message === "string"
          ? otp.body.message
          : "If this email is eligible, a verification code has been sent.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Thông tin đăng ký không hợp lệ." },
        { status: 400 },
      );
    }
    console.error(
      "register failed",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Đăng ký thất bại" },
      { status: 500 },
    );
  }
}
