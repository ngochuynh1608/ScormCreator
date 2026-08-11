"use client";

import { useCallback, useEffect, useState } from "react";

type VoiceOption = {
  code: string;
  name: string;
  gender: "male" | "female";
  locale: string;
  region?: string;
};

type ModelOption = {
  id: string;
  label: string;
};

type TtsSettingsResponse = {
  configured: boolean;
  source: "ui" | "env" | "none";
  apiKeyPreview: string;
  defaultVoiceCode: string;
  defaultModelId: string;
  voices: VoiceOption[];
  models: ModelOption[];
};

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"ui" | "env" | "none">("none");
  const [apiKeyPreview, setApiKeyPreview] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [voiceCode, setVoiceCode] = useState("");
  const [modelId, setModelId] = useState("");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/tts");
      const data = (await res.json()) as TtsSettingsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Không tải được cài đặt");
      setConfigured(Boolean(data.configured));
      setSource(data.source);
      setApiKeyPreview(data.apiKeyPreview || "");
      setVoiceCode(data.defaultVoiceCode);
      setModelId(data.defaultModelId);
      setVoices(data.voices || []);
      setModels(data.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải cài đặt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, string> = {
        defaultVoiceCode: voiceCode,
        defaultModelId: modelId,
      };
      if (apiKeyDraft.trim()) {
        body.apiKey = apiKeyDraft.trim();
      }
      const res = await fetch("/api/settings/tts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu thất bại");
      setApiKeyDraft("");
      setMessage("Đã lưu cài đặt TTS.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function clearApiKey() {
    if (!confirm("Xóa API key đã lưu trên máy chủ?")) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/tts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearApiKey: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setMessage(
        source === "env"
          ? "Đã xóa key lưu trên máy chủ. Vẫn còn key từ biến môi trường."
          : "Đã xóa API key.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setSaving(false);
    }
  }

  const voiceOptions = [
    ...voices.filter((v) => v.locale === "vi"),
    ...voices.filter((v) => v.locale !== "vi"),
  ];

  return (
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm text-[#1a2330]">
      {loading ? (
        <p className="text-sm text-[#5b6b7c]">Đang tải cài đặt…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] border border-[#eef2f6] bg-[#f7f9fb] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0f2a36]">
                    API key
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#6b7c8d]">
                    Lấy key tại{" "}
                    <a
                      href="https://everai.vn/api"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#2f6fed] underline"
                    >
                      everai.vn/api
                    </a>
                    . Key lưu trên máy chủ, UI chỉ hiện bản mask.
                  </p>
                </div>
                <StatusBadge configured={configured} source={source} />
              </div>

              {configured ? (
                <p className="mt-4 rounded-xl bg-[#eefaf4] px-3 py-2 text-xs font-medium text-[#1a5c40]">
                  Đã cấu hình: {apiKeyPreview || "••••"}
                  {source === "env" ? " (từ biến môi trường)" : ""}
                  {source === "ui" ? " (lưu từ Admin)" : ""}
                </p>
              ) : (
                <p className="mt-4 rounded-xl bg-[#fff4ec] px-3 py-2 text-xs font-medium text-[#8a3d12]">
                  Chưa có API key — cần cấu hình trước khi tạo giọng đọc AI.
                </p>
              )}

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#5b6b7c]">
                API key mới
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="Dán API key…"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#1a2330] outline-none focus:border-[#2f6fed]"
                  autoComplete="off"
                />
              </label>

              {source === "ui" || configured ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void clearApiKey()}
                  className="mt-3 text-xs font-semibold text-[#c45c26] hover:underline disabled:opacity-50"
                >
                  Xóa API key đã lưu
                </button>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-[#eef2f6] bg-[#f7f9fb] p-5">
              <h3 className="text-base font-semibold text-[#0f2a36]">Model</h3>
              <p className="mt-1 text-xs leading-5 text-[#6b7c8d]">
                Model EverAI mặc định cho mọi lần tạo TTS (có thể đổi từng lần
                trong panel narration).
              </p>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#5b6b7c]">
                Model mặc định
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#1a2330] outline-none focus:border-[#2f6fed]"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-[24px] border border-[#eef2f6] bg-[#f7f9fb] p-5">
              <h3 className="text-base font-semibold text-[#0f2a36]">
                Giọng đọc
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#6b7c8d]">
                Giọng EverAI mặc định khi tạo audio hoặc xuất SCORM.
              </p>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#5b6b7c]">
                Giọng mặc định
                <select
                  value={voiceCode}
                  onChange={(e) => setVoiceCode(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8ef] bg-white px-3 py-2.5 text-sm font-medium text-[#1a2330] outline-none focus:border-[#2f6fed]"
                >
                  {voiceOptions.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.name}
                      {v.region ? ` · ${v.region}` : ""}
                      {v.gender === "male" ? " (Nam)" : " (Nữ)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-full bg-[#2bb673] px-5 py-3 text-sm font-bold text-[#083024] disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Lưu cài đặt"}
              </button>
            </div>

            {message ? (
              <p className="text-sm font-medium text-[#1a5c40]">{message}</p>
            ) : null}
            {error ? (
              <p className="text-sm font-medium text-[#b42318]">{error}</p>
            ) : null}
          </div>
        )}
    </section>
  );
}

function StatusBadge({
  configured,
  source,
}: {
  configured: boolean;
  source: string;
}) {
  if (!configured) {
    return (
      <span className="shrink-0 rounded-full bg-[#fff4ec] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#8a3d12]">
        Chưa cấu hình
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-[#eefaf4] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1a5c40]">
      {source === "env" ? "ENV" : "OK"}
    </span>
  );
}
