import { z } from "zod";
import { COLLECTIONS, getDocumentStore } from "../store";

export type ResendSettings = {
  apiKey: string;
  from: string;
};

export type ResendPublicConfig = {
  configured: boolean;
  source: "admin" | "env" | "none";
  apiKeyPreview: string;
  from: string;
};

type SettingsDoc = ResendSettings & { id: string };

const SETTINGS_ID = "resend";

export function maskResendKey(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

export function extractFromEmail(from: string): string {
  const trimmed = from.trim();
  const angled = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  return (angled ? angled[2] : trimmed).trim();
}

export function isValidEmailFrom(from: string): boolean {
  const email = extractFromEmail(from);
  return z.string().trim().email().safeParse(email).success;
}

export async function getStoredResendSettings(): Promise<ResendSettings> {
  const store = await getDocumentStore();
  const raw = await store.get<SettingsDoc>(COLLECTIONS.settings, SETTINGS_ID);
  return {
    apiKey: raw?.apiKey?.trim() || "",
    from: raw?.from?.trim() || "",
  };
}

export async function saveResendSettings(
  patch: Partial<ResendSettings> & { clearKey?: boolean },
): Promise<ResendSettings> {
  const current = await getStoredResendSettings();
  const next: ResendSettings = {
    apiKey: current.apiKey,
    from:
      typeof patch.from === "string" ? patch.from.trim() : current.from,
  };
  if (next.from && !isValidEmailFrom(next.from)) {
    throw new Error(
      "EMAIL_FROM không hợp lệ. Dùng email hoặc định dạng Tên <email@domain>.",
    );
  }
  if (patch.clearKey) {
    next.apiKey = "";
  } else if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
    next.apiKey = patch.apiKey.trim();
  }
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.settings, { id: SETTINGS_ID, ...next });
  return next;
}

export function envResendSettings(): ResendSettings {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || "",
    from: process.env.EMAIL_FROM?.trim() || "",
  };
}

export async function resolveResendSettings(): Promise<ResendSettings> {
  const stored = await getStoredResendSettings();
  const env = envResendSettings();
  return {
    apiKey: stored.apiKey || env.apiKey,
    from: stored.from || env.from,
  };
}

export async function toResendPublicConfig(): Promise<ResendPublicConfig> {
  const stored = await getStoredResendSettings();
  const resolved = await resolveResendSettings();
  const env = envResendSettings();
  const adminReady = Boolean(stored.apiKey);
  const envReady = Boolean(env.apiKey);
  return {
    configured: Boolean(resolved.apiKey && resolved.from),
    source: adminReady ? "admin" : envReady ? "env" : "none",
    apiKeyPreview: maskResendKey(stored.apiKey || resolved.apiKey),
    from: stored.from || resolved.from,
  };
}
