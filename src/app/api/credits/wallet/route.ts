import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCreditSnapshot } from "@/lib/credits/wallet";

export const runtime = "nodejs";

/** Guest-accessible: editor can read balance without hitting /api/account. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ guest: true, wallet: null });
  }
  const wallet = await getCreditSnapshot(session.userId);
  return NextResponse.json({ guest: false, wallet });
}
