import { NextRequest, NextResponse } from "next/server";
import { isPayosConfigured, verifyWebhook } from "@/lib/payos/client";
import { fulfillPayosWebhook } from "@/lib/payos/fulfill";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!(await isPayosConfigured())) {
    return NextResponse.json({ error: "PayOS chưa cấu hình." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload = body as { data?: unknown; signature?: string };
  if (!payload?.data || !payload?.signature) {
    return NextResponse.json({ ok: true });
  }

  try {
    const data = await verifyWebhook(body);
    const paid = data.code === "00";
    const result = await fulfillPayosWebhook({
      payosOrderCode: data.orderCode,
      amount: data.amount,
      reference: data.reference || undefined,
      paid,
    });
    if (result.outcome === "amount_mismatch") {
      return NextResponse.json({ ok: true, ignored: "amount_mismatch" });
    }
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Webhook PayOS không hợp lệ.",
      },
      { status: 400 },
    );
  }
}
