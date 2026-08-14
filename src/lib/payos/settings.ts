import { COLLECTIONS, getDocumentStore } from "../store";

export type PayosSettings = {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  returnBaseUrl: string;
};

export type PayosPublicConfig = {
  configured: boolean;
  source: "admin" | "env" | "none";
  clientIdPreview: string;
  apiKeyPreview: string;
  checksumKeyPreview: string;
  returnBaseUrl: string;
  webhookUrl: string;
};

type SettingsDoc = PayosSettings & { id: string };

const SETTINGS_ID = "payos";

const EMPTY: PayosSettings = {
  clientId: "",
  apiKey: "",
  checksumKey: "",
  returnBaseUrl: "",
};

export function maskSecret(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

export async function getStoredPayosSettings(): Promise<PayosSettings> {
  const store = await getDocumentStore();
  const raw = await store.get<SettingsDoc>(COLLECTIONS.settings, SETTINGS_ID);
  return {
    clientId: raw?.clientId?.trim() || "",
    apiKey: raw?.apiKey?.trim() || "",
    checksumKey: raw?.checksumKey?.trim() || "",
    returnBaseUrl: raw?.returnBaseUrl?.trim() || "",
  };
}

export async function savePayosSettings(
  patch: Partial<PayosSettings> & { clearKeys?: boolean },
): Promise<PayosSettings> {
  const current = await getStoredPayosSettings();
  const next: PayosSettings = {
    clientId: current.clientId,
    apiKey: current.apiKey,
    checksumKey: current.checksumKey,
    returnBaseUrl:
      typeof patch.returnBaseUrl === "string"
        ? patch.returnBaseUrl.trim().replace(/\/$/, "")
        : current.returnBaseUrl,
  };
  if (next.returnBaseUrl && !/^https?:\/\//i.test(next.returnBaseUrl)) {
    throw new Error("PAYOS_RETURN_BASE_URL phải bắt đầu bằng http:// hoặc https://");
  }
  if (patch.clearKeys) {
    next.clientId = "";
    next.apiKey = "";
    next.checksumKey = "";
  } else {
    if (typeof patch.clientId === "string" && patch.clientId.trim()) {
      next.clientId = patch.clientId.trim();
    }
    if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
      next.apiKey = patch.apiKey.trim();
    }
    if (typeof patch.checksumKey === "string" && patch.checksumKey.trim()) {
      next.checksumKey = patch.checksumKey.trim();
    }
  }
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.settings, { id: SETTINGS_ID, ...next });
  return next;
}

export async function resolvePayosSettings(): Promise<PayosSettings> {
  const stored = await getStoredPayosSettings();
  return {
    clientId: stored.clientId || process.env.PAYOS_CLIENT_ID?.trim() || "",
    apiKey: stored.apiKey || process.env.PAYOS_API_KEY?.trim() || "",
    checksumKey: stored.checksumKey || process.env.PAYOS_CHECKSUM_KEY?.trim() || "",
    returnBaseUrl:
      stored.returnBaseUrl ||
      process.env.PAYOS_RETURN_BASE_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000",
  };
}

export async function toPayosPublicConfig(): Promise<PayosPublicConfig> {
  const stored = await getStoredPayosSettings();
  const resolved = await resolvePayosSettings();
  const envReady = Boolean(
    process.env.PAYOS_CLIENT_ID?.trim() &&
      process.env.PAYOS_API_KEY?.trim() &&
      process.env.PAYOS_CHECKSUM_KEY?.trim(),
  );
  const adminReady = Boolean(
    stored.clientId && stored.apiKey && stored.checksumKey,
  );
  const configured = Boolean(
    resolved.clientId && resolved.apiKey && resolved.checksumKey,
  );
  return {
    configured,
    source: adminReady ? "admin" : envReady ? "env" : "none",
    clientIdPreview: maskSecret(stored.clientId || resolved.clientId),
    apiKeyPreview: maskSecret(stored.apiKey || resolved.apiKey),
    checksumKeyPreview: maskSecret(stored.checksumKey || resolved.checksumKey),
    returnBaseUrl: resolved.returnBaseUrl,
    webhookUrl: `${resolved.returnBaseUrl}/api/payos/webhook`,
  };
}
