import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { listExistingSampleCodes } from "@/lib/tts/samples";
import {
  EVERAI_MODELS,
  findEveraiModel,
  listDefaultVoices,
  listVoicesForModel,
  voiceSupportsModelId,
} from "@/lib/tts/voices";

export const runtime = "nodejs";

/**
 * Admin: voices supported by a model.
 * EverAI has no public “list voices by model” API — we filter the catalog
 * using documented model_id / locale rules.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const modelId = req.nextUrl.searchParams.get("modelId")?.trim() || "";
  const model = findEveraiModel(modelId);
  if (!modelId || !model) {
    return NextResponse.json(
      {
        error: "Model không hợp lệ.",
        models: EVERAI_MODELS.map((m) => ({ id: m.id, label: m.label })),
      },
      { status: 400 },
    );
  }

  const standard = listVoicesForModel(modelId);
  const defaults = listDefaultVoices();
  const sampleCodes = await listExistingSampleCodes([
    ...standard.map((v) => v.code),
    ...defaults.map((v) => v.code),
  ]);
  const withMeta = (v: (typeof standard)[number]) => ({
    ...v,
    supportsModel: voiceSupportsModelId(v.code),
    hasSample: sampleCodes.includes(v.code),
  });

  return NextResponse.json({
    modelId: model.id,
    modelLabel: model.label,
    locales: model.locales,
    source: "catalog",
    note:
      "EverAI không cung cấp API danh sách giọng theo model. Danh sách lọc từ catalog theo rule model_id của docs.",
    voices: standard.map(withMeta),
    defaultVoices: defaults.map(withMeta),
  });
}
