import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getTtsSettings,
  maskApiKey,
  saveTtsSettings,
} from "@/lib/tts/settings";
import { EVERAI_MODELS, EVERAI_VOICES } from "@/lib/tts/voices";

export const runtime = "nodejs";

export async function GET() {
  // Public status for the editor (guest + logged-in). Never returns the raw key.
  // API key itself is shared from admin / env via getEveraiApiKey() on the server.
  const settings = await getTtsSettings();
  const envConfigured = Boolean(process.env.EVERAI_API_KEY?.trim());
  const configured = Boolean(settings.everaiApiKey) || envConfigured;
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
    voices: EVERAI_VOICES,
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
  } = {};

  if (typeof body.apiKey === "string") {
    // Only update key when a non-empty value is sent
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

  const saved = await saveTtsSettings(patch);
  return NextResponse.json({
    ok: true,
    configured: Boolean(saved.everaiApiKey),
    apiKeyPreview: maskApiKey(saved.everaiApiKey),
    defaultVoiceCode: saved.defaultVoiceCode,
    defaultModelId: saved.defaultModelId,
  });
}
