import { NextRequest, NextResponse } from "next/server";
import { requestOtpAction } from "@/lib/auth/email-otp";

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
      { success: false, message: "Invalid request." },
      { status: 400 },
    );
  }
  const result = await requestOtpAction(body, { ip: clientIp(req) });
  return NextResponse.json(result.body, { status: result.status });
}
