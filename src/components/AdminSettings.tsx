"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VoiceOption = {
  code: string;
  name: string;
  gender: "male" | "female";
  locale: string;
  region?: string;
  supportsModel?: boolean;
  hasSample?: boolean;
};

type ModelOption = {
  id: string;
  label: string;
};

type TtsSettingsResponse = {
  configured: boolean;
  source: "ui" | "env" | "none" | "admin";
  apiKeyPreview: string;
  defaultVoiceCode: string;
  defaultModelId: string;
  sampleText: string;
  enabledVoiceCodes: string[];
  voices: VoiceOption[];
  allVoices: VoiceOption[];
  models: ModelOption[];
};

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"ui" | "env" | "none" | "admin">("none");
  const [apiKeyPreview, setApiKeyPreview] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [voiceCode, setVoiceCode] = useState("");
  const [modelId, setModelId] = useState("");
  const [sampleText, setSampleText] = useState("");
  const [enabledCodes, setEnabledCodes] = useState<string[]>([]);
  const [allVoices, setAllVoices] = useState<VoiceOption[]>([]);
  const [modelVoices, setModelVoices] = useState<VoiceOption[]>([]);
  const [defaultVoices, setDefaultVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [sampleBusy, setSampleBusy] = useState<string | null>(null);
  const [playingCode, setPlayingCode] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadVoicesForModel = useCallback(async (nextModelId: string) => {
    if (!nextModelId) return;
    setVoicesLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tts/voices?modelId=${encodeURIComponent(nextModelId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được danh sách giọng");
      setModelVoices(data.voices || []);
      setDefaultVoices(data.defaultVoices || []);
      setAllVoices([...(data.voices || []), ...(data.defaultVoices || [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách giọng");
    } finally {
      setVoicesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/tts");
      const data = (await res.json()) as TtsSettingsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Không tải được cài đặt");
      setConfigured(Boolean(data.configured));
      setSource(data.source === "admin" ? "ui" : data.source);
      setApiKeyPreview(data.apiKeyPreview || "");
      setVoiceCode(data.defaultVoiceCode);
      setModelId(data.defaultModelId);
      setSampleText(data.sampleText || "");
      setEnabledCodes(data.enabledVoiceCodes || []);
      setModels(data.models || []);
      if (data.defaultModelId) {
        await loadVoicesForModel(data.defaultModelId);
      } else {
        setAllVoices(data.allVoices || data.voices || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải cài đặt");
    } finally {
      setLoading(false);
    }
  }, [loadVoicesForModel]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const enabledSet = useMemo(() => new Set(enabledCodes), [enabledCodes]);

  async function onModelChange(nextId: string) {
    setModelId(nextId);
    await loadVoicesForModel(nextId);
  }

  function toggleVoice(code: string) {
    setEnabledCodes((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length > 0 ? next : prev;
      }
      return [...prev, code];
    });
  }

  function selectAllForModel(codes: string[]) {
    setEnabledCodes((prev) => Array.from(new Set([...prev, ...codes])));
  }

  function clearModelVoices(codes: string[]) {
    setEnabledCodes((prev) => {
      const drop = new Set(codes);
      const next = prev.filter((c) => !drop.has(c));
      return next.length > 0 ? next : prev;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        defaultVoiceCode: voiceCode,
        defaultModelId: modelId,
        sampleText,
        enabledVoiceCodes: enabledCodes,
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

  function playSampleUrl(url: string, code: string) {
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingCode(code);
    audio.onended = () => setPlayingCode(null);
    audio.onerror = () => setPlayingCode(null);
    void audio.play().catch(() => setPlayingCode(null));
  }

  async function generateAndPlay(code: string) {
    if (!sampleText.trim()) {
      setError("Nhập đoạn text mẫu trước khi tạo giọng nghe thử.");
      return;
    }
    setSampleBusy(code);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/tts/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceCode: code,
          text: sampleText,
          modelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo mẫu thất bại");
      setAllVoices((prev) =>
        prev.map((v) => (v.code === code ? { ...v, hasSample: true } : v)),
      );
      setModelVoices((prev) =>
        prev.map((v) => (v.code === code ? { ...v, hasSample: true } : v)),
      );
      setDefaultVoices((prev) =>
        prev.map((v) => (v.code === code ? { ...v, hasSample: true } : v)),
      );
      playSampleUrl(data.sampleUrl || `/api/tts/samples/${encodeURIComponent(code)}?t=${Date.now()}`, code);
      setMessage(`Đã tạo mẫu cho ${code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo mẫu thất bại");
    } finally {
      setSampleBusy(null);
    }
  }

  function listenVoice(v: VoiceOption) {
    if (v.hasSample) {
      playSampleUrl(
        `/api/tts/samples/${encodeURIComponent(v.code)}?t=${Date.now()}`,
        v.code,
      );
      return;
    }
    void generateAndPlay(v.code);
  }

  const enabledVoiceOptions = allVoices.filter((v) => enabledSet.has(v.code));

  return (
    <section className="admin-panel">
      {loading ? (
        <p className="admin-muted !mt-0">Đang tải cài đặt…</p>
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
                {source === "ui" || source === "admin" ? " (lưu từ Admin)" : ""}
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
              Model dùng khi tạo TTS và khi tạo mẫu nghe thử cho giọng tiêu chuẩn.
            </p>
            <label className="admin-label mt-4">
              Model mặc định
              <select
                value={modelId}
                onChange={(e) => void onModelChange(e.target.value)}
                className="admin-select"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[11px] text-[#8a98a8]">
              Đổi model sẽ tải lại danh sách giọng model đó hỗ trợ.
            </p>
          </div>

          <div className="admin-subpanel">
            <h3 className="text-base font-semibold text-[#0a1f28]">
              Text mẫu nghe thử
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#3d5a66]">
              Đoạn này dùng để tạo file mẫu. Editor chỉ phát mẫu đã tạo sẵn.
            </p>
            <label className="admin-label mt-4">
              Nội dung mẫu
              <textarea
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                rows={3}
                maxLength={500}
                className="admin-input"
                placeholder="Nhập đoạn text để tạo giọng mẫu…"
              />
            </label>
            <p className="mt-1 text-[11px] text-[#8a98a8]">
              {sampleText.length}/500 ký tự
            </p>
          </div>

          <div className="admin-subpanel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#0a1f28]">
                  Giọng đọc theo model
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#3d5a66]">
                  Chọn giọng hiện trong editor. Bấm biểu tượng loa để tạo / nghe
                  mẫu (trừ credit EverAI).
                </p>
              </div>
              <p className="text-xs font-semibold text-[#3d5a66]">
                Đã chọn {enabledCodes.length}
                {voicesLoading ? " · đang tải…" : ` · ${modelVoices.length} giọng model`}
              </p>
            </div>

            {voicesLoading ? (
              <p className="admin-muted mt-4">Đang tải giọng theo model…</p>
            ) : (
              <>
                <VoiceGroup
                  title={`Giọng model hỗ trợ · ${modelId || "—"}`}
                  hint="Các giọng tiêu chuẩn dùng được với model đã chọn (model_id)."
                  voices={modelVoices}
                  enabledSet={enabledSet}
                  sampleBusy={sampleBusy}
                  playingCode={playingCode}
                  onToggle={toggleVoice}
                  onListen={listenVoice}
                  onSelectAll={() =>
                    selectAllForModel(modelVoices.map((v) => v.code))
                  }
                  onClear={() =>
                    clearModelVoices(modelVoices.map((v) => v.code))
                  }
                />

                <VoiceGroup
                  title="Giọng mặc định (rẻ)"
                  hint="Không gắn model — vẫn có thể bật cho editor."
                  voices={defaultVoices}
                  enabledSet={enabledSet}
                  sampleBusy={sampleBusy}
                  playingCode={playingCode}
                  onToggle={toggleVoice}
                  onListen={listenVoice}
                  onSelectAll={() =>
                    selectAllForModel(defaultVoices.map((v) => v.code))
                  }
                  onClear={() =>
                    clearModelVoices(defaultVoices.map((v) => v.code))
                  }
                />
              </>
            )}
          </div>

          <div className="admin-subpanel">
            <h3 className="text-base font-semibold text-[#0a1f28]">
              Giọng mặc định
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#3d5a66]">
              Giọng được chọn sẵn khi mở editor (phải nằm trong danh sách đã bật).
            </p>
            <label className="admin-label mt-4">
              Giọng mặc định
              <select
                value={
                  enabledVoiceOptions.some((v) => v.code === voiceCode)
                    ? voiceCode
                    : enabledVoiceOptions[0]?.code || ""
                }
                onChange={(e) => setVoiceCode(e.target.value)}
                className="admin-select"
              >
                {enabledVoiceOptions.map((v) => (
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

function VoiceGroup({
  title,
  hint,
  voices,
  enabledSet,
  sampleBusy,
  playingCode,
  onToggle,
  onListen,
  onSelectAll,
  onClear,
}: {
  title: string;
  hint: string;
  voices: VoiceOption[];
  enabledSet: Set<string>;
  sampleBusy: string | null;
  playingCode: string | null;
  onToggle: (code: string) => void;
  onListen: (v: VoiceOption) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (voices.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-[#e2e8ef] bg-[#f7f9fb] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0a1f28]">{title}</p>
          <p className="text-[11px] text-[#5b7380]">{hint}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="admin-link text-xs"
          >
            Chọn tất cả
          </button>
          <button type="button" onClick={onClear} className="admin-link text-xs">
            Bỏ chọn
          </button>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {voices.map((v) => {
          const enabled = enabledSet.has(v.code);
          const busy = sampleBusy === v.code;
          const playing = playingCode === v.code;
          return (
            <li
              key={v.code}
              className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => onToggle(v.code)}
                  className="shrink-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#0a1f28]">
                    {v.name}
                    {v.region ? ` · ${v.region}` : ""}
                  </span>
                  <span className="block truncate text-[11px] text-[#8a98a8]">
                    {v.code}
                    {v.hasSample ? " · có mẫu" : " · chưa có mẫu"}
                  </span>
                </span>
              </label>
              <button
                type="button"
                title={v.hasSample ? "Nghe mẫu" : "Tạo và nghe mẫu"}
                disabled={busy}
                onClick={() => onListen(v)}
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  playing
                    ? "border-[#1aa86b] bg-[#e5f6ee] text-[#1a5c40]"
                    : "border-[#d5e1ea] bg-white text-[#0a1f28] hover:bg-[#f3f7fa]"
                } disabled:opacity-50`}
              >
                {busy ? (
                  <span className="text-[10px] font-bold">…</span>
                ) : (
                  <SpeakerIcon />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4h3.2L12 18V6L7.2 10H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 9.2a3.2 3.2 0 0 1 0 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
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
