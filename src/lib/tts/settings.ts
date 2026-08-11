import { COLLECTIONS, getDocumentStore } from "../store";
import { DEFAULT_MODEL, DEFAULT_VOICE } from "./voices";

export type TtsSettings = {
  everaiApiKey: string;
  defaultVoiceCode: string;
  defaultModelId: string;
};

type SettingsDoc = TtsSettings & { id: string };

const SETTINGS_ID = "default";

const DEFAULTS: TtsSettings = {
  everaiApiKey: "",
  defaultVoiceCode: DEFAULT_VOICE,
  defaultModelId: DEFAULT_MODEL,
};

export async function getTtsSettings(): Promise<TtsSettings> {
  const store = await getDocumentStore();
  const raw = await store.get<SettingsDoc>(COLLECTIONS.settings, SETTINGS_ID);
  return {
    ...DEFAULTS,
    ...raw,
    everaiApiKey: raw?.everaiApiKey?.trim() || "",
    defaultVoiceCode: raw?.defaultVoiceCode || DEFAULTS.defaultVoiceCode,
    defaultModelId: raw?.defaultModelId || DEFAULTS.defaultModelId,
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
