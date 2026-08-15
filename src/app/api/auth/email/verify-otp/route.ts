import { NextRequest, NextResponse } from "next/server";
import { verifyOtpAction } from "@/lib/auth/email-otp";
import {
  attachSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";
import { sessionPayloadFromUser } from "@/lib/auth/session-user";

export const runtime = "nodejs";

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        message: "Invalid or expired verification code.",
      },
      { status: 400 },
    );
  }

  const result = await verifyOtpAction(body, { ip: clientIp(req) });
  const res = NextResponse.json(result.body, { status: result.status });
  if (result.sessionUser && result.body.verified) {
    const token = await createSessionToken(
      await sessionPayloadFromUser(result.sessionUser),
    );
    return attachSessionCookie(res, token);
  }
  return res;
}
