import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import {
  saveResendSettings,
  toResendPublicConfig,
} from "@/lib/email/settings";
import { resetResendClient, sendTestEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json({ email: await toResendPublicConfig() });
}

const saveSchema = z.object({
  apiKey: z.string().max(300).optional(),
  from: z.string().trim().max(200).optional(),
  clearKey: z.boolean().optional(),
});

const testSchema = z.object({
  action: z.literal("test"),
  to: z.string().trim().email(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const raw: unknown = await req.json();
    const isTest =
      typeof raw === "object" &&
      raw !== null &&
      "action" in raw &&
      (raw as { action?: unknown }).action === "test";
    if (isTest) {
      const body = testSchema.parse(raw);
      const result = await sendTestEmail(body.to);
      return NextResponse.json({
        ok: true,
        message: "Đã gửi email thử. Kiểm tra hộp thư (và spam).",
        id: result.id,
      });
    }
    const body = saveSchema.parse(raw);
    await saveResendSettings({
      apiKey: body.apiKey,
      from: body.from,
      clearKey: body.clearKey,
    });
    resetResendClient();
    return NextResponse.json({ email: await toResendPublicConfig() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    const message =
      err instanceof Error ? err.message : "Thao tác email thất bại";
    const safe = message
      .replace(/\b\d{6}\b/g, "[redacted]")
      .replace(/re_[A-Za-z0-9]+/g, "re_[redacted]");
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
