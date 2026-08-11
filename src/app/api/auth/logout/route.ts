import { NextResponse } from "next/server";
import { clearSessionOnResponse } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clearSessionOnResponse(res);
}
