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
    <section className="admin-panel">
      {loading ? (
        <p className="admin-muted !mt-0">
          Đang tải cài đặt…
        </p>
      ) : (
        <div className="admin-stack">
          <div className="admin-subpanel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#0a1f28]">
                  API key
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#3d5a66]">
                  Lấy key tại{" "}
                  <a
                    href="https://everai.vn/api"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#0a1f28] underline decoration-[#1aa86b] underline-offset-2"
                  >
                    everai.vn/api
                  </a>
                  . Key lưu trên máy chủ, UI chỉ hiện bản mask.
                </p>
              </div>
              <StatusBadge configured={configured} source={source} />
            </div>

            {configured ? (
              <p className="admin-alert-ok mt-4">
                Đã cấu hình: {apiKeyPreview || "••••"}
                {source === "env" ? " (từ biến môi trường)" : ""}
                {source === "ui" ? " (lưu từ Admin)" : ""}
              </p>
            ) : (
              <p className="admin-alert-error mt-4">
                Chưa có API key — cần cấu hình trước khi tạo giọng đọc AI.
              </p>
            )}

            <label className="admin-label mt-4">
              API key mới
              <input
                type="password"
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                placeholder="Dán API key…"
                className="admin-input"
                autoComplete="off"
              />
            </label>

            {source === "ui" || configured ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void clearApiKey()}
                className="admin-link admin-link-danger mt-3"
              >
                Xóa API key đã lưu
              </button>
            ) : null}
          </div>

          <div className="admin-subpanel">
            <h3 className="text-base font-semibold text-[#0a1f28]">Model</h3>
            <p className="mt-1 text-xs leading-5 text-[#3d5a66]">
              Model mặc định cho mọi lần tạo TTS (có thể đổi từng lần trong panel
              narration).
            </p>
            <label className="admin-label mt-4">
              Model mặc định
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="admin-select"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-subpanel">
            <h3 className="text-base font-semibold text-[#0a1f28]">Giọng đọc</h3>
            <p className="mt-1 text-xs leading-5 text-[#3d5a66]">
              Giọng mặc định khi tạo audio hoặc xuất SCORM.
            </p>
            <label className="admin-label mt-4">
              Giọng mặc định
              <select
                value={voiceCode}
                onChange={(e) => setVoiceCode(e.target.value)}
                className="admin-select"
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

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="admin-btn-primary"
            >
              {saving ? "Đang lưu…" : "Lưu cài đặt"}
            </button>
          </div>

          {message ? <p className="admin-alert-ok">{message}</p> : null}
          {error ? <p className="admin-alert-error">{error}</p> : null}
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
      <span className="admin-badge admin-badge-warn shrink-0">Chưa cấu hình</span>
    );
  }
  return (
    <span className="admin-badge admin-badge-ok shrink-0">
      {source === "env" ? "ENV" : "OK"}
    </span>
  );
}
