import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getEveraiApiKey, getTtsSettings } from "@/lib/tts/settings";
import { generateVoiceSample } from "@/lib/tts/samples";

export const runtime = "nodejs";
export const maxDuration = 180;

const schema = z.object({
  voiceCode: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(500).optional(),
  modelId: z.string().trim().min(1).max(80).optional(),
});

/** Admin: generate/regenerate a cached voice sample for preview. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = schema.parse(await req.json());
    const apiKey = await getEveraiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chưa cấu hình API key EverAI." },
        { status: 400 },
      );
    }
    const settings = await getTtsSettings();
    const text = body.text?.trim() || settings.sampleText;
    const modelId = body.modelId || settings.defaultModelId;
    const result = await generateVoiceSample({
      apiKey,
      voiceCode: body.voiceCode,
      text,
      modelId,
    });
    return NextResponse.json({
      ok: true,
      voiceCode: result.voiceCode,
      bytes: result.bytes,
      sampleUrl: `/api/tts/samples/${encodeURIComponent(result.voiceCode)}?t=${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tạo mẫu thất bại" },
      { status: 500 },
    );
  }
}
