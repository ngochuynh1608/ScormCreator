import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getEnabledVoices,
  getTtsSettings,
  maskApiKey,
  saveTtsSettings,
} from "@/lib/tts/settings";
import { listExistingSampleCodes } from "@/lib/tts/samples";
import { EVERAI_MODELS, EVERAI_VOICES, voiceSupportsModelId } from "@/lib/tts/voices";

export const runtime = "nodejs";

export async function GET() {
  // Public status for the editor (guest + logged-in). Never returns the raw key.
  const settings = await getTtsSettings();
  const envConfigured = Boolean(process.env.EVERAI_API_KEY?.trim());
  const configured = Boolean(settings.everaiApiKey) || envConfigured;
  const enabledVoices = getEnabledVoices(settings);
  const sampleCodes = await listExistingSampleCodes(
    EVERAI_VOICES.map((v) => v.code),
  );
  return NextResponse.json({
    configured,
    source: settings.everaiApiKey
      ? "admin"
      : envConfigured
        ? "env"
        : "none",
    apiKeyPreview: settings.everaiApiKey
      ? maskApiKey(settings.everaiApiKey)
      : envConfigured
        ? "••••env"
        : "",
    defaultVoiceCode: settings.defaultVoiceCode,
    defaultModelId: settings.defaultModelId,
    sampleText: settings.sampleText,
    enabledVoiceCodes: settings.enabledVoiceCodes,
    /** Voices available in the editor (admin-selected). */
    voices: enabledVoices.map((v) => ({
      ...v,
      supportsModel: voiceSupportsModelId(v.code),
      hasSample: sampleCodes.includes(v.code),
    })),
    /** Full catalog for admin configuration. */
    allVoices: EVERAI_VOICES.map((v) => ({
      ...v,
      supportsModel: voiceSupportsModelId(v.code),
      hasSample: sampleCodes.includes(v.code),
    })),
    models: EVERAI_MODELS,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await req.json();
  const patch: {
    everaiApiKey?: string;
    defaultVoiceCode?: string;
    defaultModelId?: string;
    enabledVoiceCodes?: string[];
    sampleText?: string;
  } = {};

  if (typeof body.apiKey === "string") {
    if (body.apiKey.trim()) patch.everaiApiKey = body.apiKey;
  }
  if (typeof body.everaiApiKey === "string") {
    if (body.everaiApiKey.trim()) patch.everaiApiKey = body.everaiApiKey;
  }
  if (body.clearApiKey === true) {
    patch.everaiApiKey = "";
  }
  if (typeof body.defaultVoiceCode === "string") {
    patch.defaultVoiceCode = body.defaultVoiceCode;
  }
  if (typeof body.defaultModelId === "string") {
    patch.defaultModelId = body.defaultModelId;
  }
  if (Array.isArray(body.enabledVoiceCodes)) {
    patch.enabledVoiceCodes = body.enabledVoiceCodes;
  }
  if (typeof body.sampleText === "string") {
    patch.sampleText = body.sampleText;
  }

  const saved = await saveTtsSettings(patch);
  return NextResponse.json({
    ok: true,
    configured: Boolean(saved.everaiApiKey),
    apiKeyPreview: maskApiKey(saved.everaiApiKey),
    defaultVoiceCode: saved.defaultVoiceCode,
    defaultModelId: saved.defaultModelId,
    enabledVoiceCodes: saved.enabledVoiceCodes,
    sampleText: saved.sampleText,
  });
}
