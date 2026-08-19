import { COLLECTIONS, getDocumentStore } from "../store";
import {
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  EVERAI_VOICES,
  listVoicesForModel,
  voiceSupportsModelId,
  type EveraiVoice,
} from "./voices";

export type TtsSettings = {
  everaiApiKey: string;
  defaultVoiceCode: string;
  defaultModelId: string;
  /** Voice codes shown in the project editor. Empty = all voices. */
  enabledVoiceCodes: string[];
  /** Text used when generating voice preview samples. */
  sampleText: string;
};

type SettingsDoc = TtsSettings & { id: string };

const SETTINGS_ID = "default";

export const DEFAULT_SAMPLE_TEXT =
  "Xin chào, đây là giọng đọc mẫu của Scorm Pro.";

const DEFAULTS: TtsSettings = {
  everaiApiKey: "",
  defaultVoiceCode: DEFAULT_VOICE,
  defaultModelId: DEFAULT_MODEL,
  enabledVoiceCodes: EVERAI_VOICES.map((v) => v.code),
  sampleText: DEFAULT_SAMPLE_TEXT,
};

function normalizeEnabledCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULTS.enabledVoiceCodes];
  const known = new Set(EVERAI_VOICES.map((v) => v.code));
  const codes = raw
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter((c) => known.has(c));
  return codes.length > 0
    ? Array.from(new Set(codes))
    : [...DEFAULTS.enabledVoiceCodes];
}

export async function getTtsSettings(): Promise<TtsSettings> {
  const store = await getDocumentStore();
  const raw = await store.get<SettingsDoc>(COLLECTIONS.settings, SETTINGS_ID);
  return {
    ...DEFAULTS,
    ...raw,
    everaiApiKey: raw?.everaiApiKey?.trim() || "",
    defaultVoiceCode: raw?.defaultVoiceCode || DEFAULTS.defaultVoiceCode,
    defaultModelId: raw?.defaultModelId || DEFAULTS.defaultModelId,
    enabledVoiceCodes: normalizeEnabledCodes(raw?.enabledVoiceCodes),
    sampleText:
      typeof raw?.sampleText === "string" && raw.sampleText.trim()
        ? raw.sampleText.trim().slice(0, 500)
        : DEFAULTS.sampleText,
  };
}

export async function saveTtsSettings(
  patch: Partial<TtsSettings>,
): Promise<TtsSettings> {
  const store = await getDocumentStore();
  const current = await getTtsSettings();
  const next: TtsSettings = {
    ...current,
    ...patch,
  };
  if (typeof patch.everaiApiKey === "string") {
    next.everaiApiKey = patch.everaiApiKey.trim();
  }
  if (patch.enabledVoiceCodes !== undefined) {
    next.enabledVoiceCodes = normalizeEnabledCodes(patch.enabledVoiceCodes);
  }
  if (typeof patch.sampleText === "string") {
    next.sampleText =
      patch.sampleText.trim().slice(0, 500) || DEFAULT_SAMPLE_TEXT;
  }
  if (
    next.defaultVoiceCode &&
    !next.enabledVoiceCodes.includes(next.defaultVoiceCode)
  ) {
    next.defaultVoiceCode = next.enabledVoiceCodes[0] || DEFAULT_VOICE;
  }
  await store.put(COLLECTIONS.settings, { id: SETTINGS_ID, ...next });
  return next;
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(12, key.length - 4))}${key.slice(-4)}`;
}

export async function getEveraiApiKey(): Promise<string | null> {
  const settings = await getTtsSettings();
  if (settings.everaiApiKey) return settings.everaiApiKey;
  const envKey = process.env.EVERAI_API_KEY?.trim();
  return envKey || null;
}

/** Voices that accept `model_id` for the given EverAI model. */
export function voicesForModel(modelId: string): EveraiVoice[] {
  return listVoicesForModel(modelId);
}

export function getEnabledVoices(settings: TtsSettings): EveraiVoice[] {
  const set = new Set(settings.enabledVoiceCodes);
  const list = EVERAI_VOICES.filter((v) => set.has(v.code));
  return list.length > 0 ? list : [...EVERAI_VOICES];
}

export { voiceSupportsModelId };
