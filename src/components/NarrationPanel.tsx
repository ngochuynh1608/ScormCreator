"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentSlide, ScormPlayerSettings } from "@/lib/types";
import { estimateDurationMs, formatSeconds } from "@/lib/tts/estimate";
import { estimateCredits } from "@/lib/tts/voices";
import { DEFAULT_SCORM_SETTINGS } from "@/lib/scorm/settings";
import { SlideDesignPanel } from "@/components/SlideDesignPanel";

type AudioMode = "ai" | "file";

export type TtsVoiceOption = {
  code: string;
  name: string;
  gender: "male" | "female";
  locale: string;
  region?: string;
};

export type TtsModelOption = {
  id: string;
  label: string;
};

type Props = {
  projectId: string;
  slide: ContentSlide;
  rate: number;
  pitch: number;
  ttsBusy: boolean;
  ttsBusyForSlide: boolean;
  ttsBusyOtherSlide: boolean;
  voiceCode: string;
  modelId: string;
  voices: TtsVoiceOption[];
  models: TtsModelOption[];
  apiConfigured: boolean;
  apiKeyPreview: string;
  scormSettings: ScormPlayerSettings;
  onScormSettingsChange: (next: ScormPlayerSettings) => void;
  onRateChange: (v: number) => void;
  onPitchChange: (v: number) => void;
  onVoiceChange: (code: string) => void;
  onModelChange: (id: string) => void;
  onScriptChange: (script: string) => void;
  onPreview: (text: string) => void;
  onGenerate: (text: string) => void;
  onGenerateAll: () => void;
  onCancelTts?: () => void;
  cancellingTts?: boolean;
  onDesignChange: (patch: Partial<ContentSlide>) => void;
  onUploadOverlayImage: (file: File) => Promise<string | null>;
  designBusy?: boolean;
  onUploadAudio: (file: File) => void;
  onAssignExistingAudio: (audioPath: string) => void;
  onImportNarrationDocx: (file: File) => void;
  importBusy?: boolean;
  audioUrl: string | null;
  creditGuest?: boolean;
  creditsAvailable?: number | null;
};

export function NarrationPanel({
  projectId,
  slide,
  rate,
  pitch,
  ttsBusy,
  ttsBusyForSlide,
  ttsBusyOtherSlide,
  voiceCode,
  modelId,
  voices,
  models,
  apiConfigured,
  apiKeyPreview,
  scormSettings,
  onScormSettingsChange,
  onRateChange,
  onPitchChange,
  onVoiceChange,
  onModelChange,
  onScriptChange,
  onPreview,
  onGenerate,
  onGenerateAll,
  onCancelTts,
  cancellingTts = false,
  onDesignChange,
  onUploadOverlayImage,
  designBusy = false,
  onUploadAudio,
  onAssignExistingAudio,
  onImportNarrationDocx,
  importBusy = false,
  audioUrl,
  creditGuest = false,
  creditsAvailable = null,
}: Props) {
  const [mode, setMode] = useState<AudioMode>("ai");
  const [script, setScript] = useState(slide.narrationScript || "");
  const [showSettings, setShowSettings] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [draftSettings, setDraftSettings] = useState<ScormPlayerSettings>(
    scormSettings || DEFAULT_SCORM_SETTINGS,
  );
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryFiles, setLibraryFiles] = useState<
    {
      relativePath: string;
      fileName: string;
      sizeBytes: number;
      mtimeMs: number;
      usedBy: { id: string; order: number; title: string }[];
    }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const docxRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autosizeTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    const min = 96;
    const max = 360;
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight))}px`;
  }

  useEffect(() => {
    setScript(slide.narrationScript || "");
    setShowDesign(false);
  }, [slide.id, slide.narrationScript]);

  useEffect(() => {
    setDraftSettings(scormSettings || DEFAULT_SCORM_SETTINGS);
  }, [scormSettings]);

  useEffect(() => {
    autosizeTextarea(textareaRef.current);
  }, [script, slide.id, mode]);

  const estimatedMs = useMemo(
    () => estimateDurationMs(script, rate),
    [script, rate],
  );
  const durationMs = slide.audioDurationMs ?? estimatedMs;
  const creditEstimate = useMemo(
    () => estimateCredits(script.trim().length, voiceCode),
    [script, voiceCode],
  );
  const outOfCredits =
    !creditGuest &&
    creditsAvailable != null &&
    script.trim().length > 0 &&
    creditsAvailable < creditEstimate;
  const blockAiGenerate =
    creditGuest || outOfCredits || (creditsAvailable === 0 && !creditGuest);

  const voiceOptions = useMemo(() => {
    const list = voices ?? [];
    const vi = list.filter((v) => v.locale === "vi");
    const rest = list.filter((v) => v.locale !== "vi");
    return [...vi, ...rest];
  }, [voices]);

  function commitScript() {
    if (script !== (slide.narrationScript || "")) {
      onScriptChange(script);
    }
  }

  async function openAudioLibrary() {
    setShowLibrary(true);
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/audio`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được danh sách audio");
      setLibraryFiles(data.files || []);
    } catch (err) {
      setLibraryError(
        err instanceof Error ? err.message : "Không tải được danh sách audio",
      );
      setLibraryFiles([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <aside className="flex flex-col gap-3 rounded-[28px] bg-[#eef1f4] p-3 text-[#1a2330]">
      <div className="flex items-center justify-between rounded-full bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f3f6] text-[#5b6b7c]">
            <VoiceIcon />
          </span>
          <span className="text-base leading-none" aria-hidden>
            🇻🇳
          </span>
          <span className="text-sm font-semibold">Tiếng Việt</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={docxRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onImportNarrationDocx(f);
            }}
          />
          <button
            type="button"
            title="Tạo audio EverAI cho toàn bộ slide (ghi đè audio cũ)"
            disabled={ttsBusy || importBusy || !apiConfigured || blockAiGenerate}
            onClick={onGenerateAll}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7c8d] hover:bg-[#f0f3f6] disabled:opacity-50"
          >
            <GenerateAllIcon />
          </button>
          {ttsBusy && onCancelTts ? (
            <button
              type="button"
              title="Dừng tạo audio / hủy job TTS đang xếp hàng"
              disabled={cancellingTts}
              onClick={onCancelTts}
              className="flex h-8 items-center gap-1 rounded-full bg-[#fdecea] px-2.5 text-xs font-bold text-[#c62828] hover:bg-[#f8d7d3] disabled:opacity-50"
            >
              {cancellingTts ? "…" : "Dừng"}
            </button>
          ) : null}
          <button
            type="button"
            title="Nhập lời thoại từ file DOCX (bảng Slide | Nội dung)"
            disabled={importBusy || ttsBusy}
            onClick={() => docxRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7c8d] hover:bg-[#f0f3f6] disabled:opacity-50"
          >
            <DocImportIcon />
          </button>
          <button
            type="button"
            title="Cài đặt SCORM"
            onClick={() => {
              setShowDesign(false);
              setDraftSettings(scormSettings || DEFAULT_SCORM_SETTINGS);
              setShowSettings((v) => !v);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7c8d] hover:bg-[#f0f3f6]"
          >
            <SettingsIcon />
          </button>
          <button
            type="button"
            title="Design — chỉnh ảnh slide"
            onClick={() => {
              setShowSettings(false);
              setShowDesign((v) => !v);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f0f3f6] ${
              showDesign ? "bg-[#e8f8ef] text-[#1f7a4d]" : "text-[#6b7c8d]"
            }`}
          >
            <DesignIcon />
          </button>
          <button
            type="button"
            title="Trợ giúp"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7c8d] hover:bg-[#f0f3f6]"
          >
            <HelpIcon />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-[#1a2330]">
              Cài đặt SCORM
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b7c8d]">
              Áp dụng khi xuất gói SCORM của dự án này.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl bg-[#f7f9fb] px-3 py-2 text-[11px] font-semibold text-[#5b6b7c]">
              Màu nút chính
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={draftSettings.buttonPrimary}
                  onChange={(e) =>
                    setDraftSettings((s) => ({
                      ...s,
                      buttonPrimary: e.target.value,
                    }))
                  }
                  className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent"
                />
                <span className="text-xs font-medium text-[#1a2330]">
                  {draftSettings.buttonPrimary}
                </span>
              </div>
            </label>
            <label className="rounded-xl bg-[#f7f9fb] px-3 py-2 text-[11px] font-semibold text-[#5b6b7c]">
              Màu nút phụ
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={draftSettings.buttonSecondary}
                  onChange={(e) =>
                    setDraftSettings((s) => ({
                      ...s,
                      buttonSecondary: e.target.value,
                    }))
                  }
                  className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent"
                />
                <span className="text-xs font-medium text-[#1a2330]">
                  {draftSettings.buttonSecondary}
                </span>
              </div>
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-[#5b6b7c]">
              Nền quiz
            </p>
            <div className="inline-flex rounded-full bg-[#f0f3f6] p-1">
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((s) => ({ ...s, quizTheme: "light" }))
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  draftSettings.quizTheme === "light"
                    ? "bg-white text-[#1a2330] shadow-sm"
                    : "text-[#6b7c8d]"
                }`}
              >
                Sáng
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((s) => ({ ...s, quizTheme: "dark" }))
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  draftSettings.quizTheme === "dark"
                    ? "bg-white text-[#1a2330] shadow-sm"
                    : "text-[#6b7c8d]"
                }`}
              >
                Tối
              </button>
            </div>
          </div>

          <label className="rounded-xl bg-[#f7f9fb] px-3 py-2 text-[11px] font-semibold text-[#5b6b7c]">
            Điểm hoàn thành SCORM (%)
            <input
              type="number"
              min={0}
              max={100}
              value={draftSettings.passScore}
              onChange={(e) =>
                setDraftSettings((s) => ({
                  ...s,
                  passScore: Number(e.target.value),
                }))
              }
              className="mt-1 w-full rounded-lg border-0 bg-white px-3 py-2 text-sm font-medium text-[#1a2330] outline-none ring-1 ring-[#e2e8ef]"
            />
            <span className="mt-1 block text-[11px] font-normal text-[#8a98a8]">
              Passed khi đạt ≥ {draftSettings.passScore}% điểm quiz tối đa.
            </span>
          </label>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-[#5b6b7c]">
              Nghe audio trước khi sang slide
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#1a2330]">
                <input
                  type="radio"
                  name="audio-nav"
                  className="mt-1"
                  checked={!draftSettings.requireFullAudio}
                  onChange={() =>
                    setDraftSettings((s) => ({
                      ...s,
                      requireFullAudio: false,
                    }))
                  }
                />
                <span>
                  <span className="font-semibold">Cho phép xem nhanh</span>
                  <span className="mt-0.5 block text-xs text-[#6b7c8d]">
                    Có thể bấm Tiếp trước khi audio kết thúc.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#1a2330]">
                <input
                  type="radio"
                  name="audio-nav"
                  className="mt-1"
                  checked={draftSettings.requireFullAudio}
                  onChange={() =>
                    setDraftSettings((s) => ({
                      ...s,
                      requireFullAudio: true,
                    }))
                  }
                />
                <span>
                  <span className="font-semibold">Bắt buộc nghe hết</span>
                  <span className="mt-0.5 block text-xs text-[#6b7c8d]">
                    Nút Tiếp khóa đến khi audio phát xong.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onScormSettingsChange(draftSettings);
                setShowSettings(false);
              }}
              className="rounded-full bg-[#2bb673] px-4 py-2 text-sm font-bold text-[#083024]"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftSettings(scormSettings || DEFAULT_SCORM_SETTINGS);
                setShowSettings(false);
              }}
              className="rounded-full bg-[#e8eef5] px-4 py-2 text-sm font-semibold text-[#1a2330]"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      {showDesign ? (
        <SlideDesignPanel
          projectId={projectId}
          slide={slide}
          busy={designBusy}
          onChange={onDesignChange}
          onUploadOverlayImage={onUploadOverlayImage}
          onClose={() => setShowDesign(false)}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#2a3644]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2f6fed] text-[10px] text-white">
            ●
          </span>
          Bắt đầu
        </div>
        <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              mode === "file"
                ? "bg-[#e8eef5] text-[#1a2330]"
                : "text-[#6b7c8d] hover:text-[#1a2330]"
            }`}
          >
            Tệp âm thanh
          </button>
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              mode === "ai"
                ? "bg-[#e8eef5] text-[#1a2330]"
                : "text-[#6b7c8d] hover:text-[#1a2330]"
            }`}
          >
            AI
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <>
          <div className="grid grid-cols-1 gap-2">
            <label className="rounded-2xl bg-white px-3 py-2 text-[11px] font-semibold text-[#5b6b7c] shadow-sm">
              Giọng đọc EverAI
              <select
                value={voiceCode}
                onChange={(e) => onVoiceChange(e.target.value)}
                className="mt-1 w-full rounded-lg border-0 bg-[#f7f9fb] px-2 py-2 text-sm font-medium text-[#1a2330] outline-none"
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

          <div className="flex flex-col rounded-[22px] bg-white shadow-sm">
            <textarea
              ref={textareaRef}
              value={script}
              onChange={(e) => {
                setScript(e.target.value);
                autosizeTextarea(e.currentTarget);
              }}
              onBlur={commitScript}
              rows={3}
              placeholder="Nhập kịch bản lời thoại cho slide này…"
              className="resize-none overflow-y-auto border-0 bg-transparent px-4 pb-2 pt-4 text-[15px] leading-7 text-[#222c38] outline-none placeholder:text-[#9aa7b5]"
            />
            <div className="flex items-center justify-between gap-3 border-t border-[#eef1f4] px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  commitScript();
                  onPreview(script);
                }}
                title="Nghe thử"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f5f7] text-[#2a3644] hover:bg-[#e7ebf0]"
              >
                <SpeakerIcon />
              </button>
              <div className="flex items-center gap-4 text-sm font-medium text-[#5b6b7c]">
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon />
                  {formatSeconds(0)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HourglassIcon />
                  {formatSeconds(durationMs)}
                </span>
              </div>
            </div>
          </div>

          {!apiConfigured ? (
            <p className="px-1 text-xs text-[#c45c26]">
              Hệ thống chưa cấu hình API key EverAI. Liên hệ admin (mục TTS trong
              trang quản trị).
            </p>
          ) : creditGuest ? (
            <p className="px-1 text-xs text-[#c45c26]">
              Đăng nhập và lưu dự án vào tài khoản để tạo audio AI (trừ credit).
            </p>
          ) : (
            <p className="px-1 text-xs text-[#5b6b7c]">
              Còn{" "}
              <span className="font-semibold text-[#0f2a36]">
                {(creditsAvailable ?? 0).toLocaleString("vi-VN")}
              </span>{" "}
              credit
              {script.trim()
                ? ` · ước lượng ${creditEstimate.toLocaleString("vi-VN")} credit cho slide này`
                : ""}
              {outOfCredits ? (
                <>
                  {" "}
                  —{" "}
                  <a href="/account/payments" className="font-semibold text-[#c45c26] underline">
                    nạp thêm
                  </a>
                </>
              ) : null}
            </p>
          )}

          <button
            type="button"
            disabled={
              ttsBusy || !script.trim() || !apiConfigured || blockAiGenerate
            }
            onClick={() => {
              onGenerate(script);
            }}
            className="rounded-full bg-[#2bb673] px-4 py-3 text-sm font-bold text-[#083024] disabled:opacity-50"
          >
            {ttsBusyForSlide
              ? "Đang tạo giọng đọc…"
              : ttsBusyOtherSlide
                ? "Đang tạo slide khác…"
                : "Tạo giọng đọc AI"}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-[#5b6b7c]">
            Tải lên file ghi âm có sẵn (mp3, wav, ogg) thay cho giọng AI, hoặc gắn
            lại audio đã có trong dự án nếu bị gán nhầm slide.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadAudio(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-[#e8eef5] px-4 py-3 text-sm font-bold text-[#1a2330]"
          >
            Chọn tệp âm thanh
          </button>
          <button
            type="button"
            onClick={() => void openAudioLibrary()}
            className="rounded-full border border-[#d5dde6] bg-white px-4 py-3 text-sm font-bold text-[#1a2330] hover:bg-[#f7f9fb]"
          >
            Chọn audio có sẵn trong dự án
          </button>

          {showLibrary ? (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-2xl border border-[#e6ebf0] bg-[#f7f9fb] p-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold text-[#5b6b7c]">
                  Audio trong thư mục dự án
                </p>
                <button
                  type="button"
                  onClick={() => setShowLibrary(false)}
                  className="text-xs font-semibold text-[#6b7c8d] hover:text-[#1a2330]"
                >
                  Đóng
                </button>
              </div>
              {libraryLoading ? (
                <p className="px-1 text-xs text-[#8a98a8]">Đang tải danh sách…</p>
              ) : null}
              {libraryError ? (
                <p className="px-1 text-xs text-[#c45c26]">{libraryError}</p>
              ) : null}
              {!libraryLoading && !libraryError && libraryFiles.length === 0 ? (
                <p className="px-1 text-xs text-[#8a98a8]">
                  Chưa có file audio nào trong dự án.
                </p>
              ) : null}
              {libraryFiles.map((f) => {
                const active = slide.audioPath === f.relativePath;
                const usedLabel =
                  f.usedBy.length === 0
                    ? "Chưa gắn slide"
                    : f.usedBy
                        .map((s) => `Slide ${s.order + 1}`)
                        .join(", ");
                return (
                  <div
                    key={f.relativePath}
                    className={`flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm ${
                      active ? "ring-2 ring-[#2bb673]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1a2330]">
                          {f.fileName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8a98a8]">
                          {formatBytes(f.sizeBytes)} · {usedLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={active}
                        onClick={() => {
                          onAssignExistingAudio(f.relativePath);
                          setShowLibrary(false);
                        }}
                        className="shrink-0 rounded-full bg-[#2bb673] px-3 py-1.5 text-xs font-bold text-[#083024] disabled:opacity-50"
                      >
                        {active ? "Đang dùng" : "Gắn vào slide"}
                      </button>
                    </div>
                    <audio
                      controls
                      preload="none"
                      className="w-full"
                      src={`/api/files/${projectId}/${f.relativePath}?v=${f.mtimeMs}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {audioUrl ? (
        <audio key={audioUrl} controls className="w-full" src={audioUrl} />
      ) : (
        <p className="px-1 text-center text-xs text-[#8a98a8]">
          Chưa gắn audio cho slide
        </p>
      )}
    </aside>
  );
}

function GenerateAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17.5 4.5v4M15.5 6.5h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v5h5M9 13h6M9 17h6M9 9h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DesignIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 12 4.5 7.5M12 12l7.5-4.5M12 12v9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.5 9.5a2.5 2.5 0 1 1 3.7 2.2c-.8.4-1.2.9-1.2 1.8V14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 5 6 9H3v6h3l5 4V5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8.5a4.5 4.5 0 0 1 0 7M18 6a8 8 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h12M6 20h12M8 4c0 4 4 5 4 8s-4 4-4 8M16 4c0 4-4 5-4 8s4 4 4 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
