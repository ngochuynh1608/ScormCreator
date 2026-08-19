"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadProgressBar,
  type UploadProgressState,
} from "@/components/UploadProgressBar";

export function ConfirmDeleteSlideModal({
  open,
  slideLabel,
  busy,
  onCancel,
  onConfirm,
  title = "Xóa slide?",
  confirmLabel = "Xóa slide",
}: {
  open: boolean;
  slideLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-slide-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-slide-title"
          className="text-lg font-semibold text-[#0f2a36]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
          Bạn có chắc chắn muốn xóa{" "}
          <span className="font-semibold text-[#1a2330]">{slideLabel}</span>?
          Thao tác này không thể hoàn tác.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full bg-[#e35d3d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang xóa…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmGenerateAllAudioModal({
  open,
  slideCount,
  voiceLabel,
  creditEstimate,
  creditsAvailable,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  slideCount: number;
  voiceLabel?: string;
  creditEstimate?: number;
  creditsAvailable?: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-all-audio-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eefaf4] text-[#1a5c40]">
          <MicBatchIcon />
        </div>
        <h2
          id="generate-all-audio-title"
          className="mt-4 text-lg font-semibold text-[#0f2a36]"
        >
          Tạo audio cho toàn bộ slide?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
          Sẽ tạo lại giọng đọc EverAI cho{" "}
          <span className="font-semibold text-[#1a2330]">
            {slideCount} slide nội dung
          </span>{" "}
          có kịch bản.
          {voiceLabel ? (
            <>
              {" "}
              Giọng đang chọn:{" "}
              <span className="font-semibold text-[#1a2330]">{voiceLabel}</span>.
            </>
          ) : null}
        </p>
        <ul className="mt-3 space-y-1.5 text-sm leading-6 text-[#5b6b7c]">
          <li>• Audio cũ trên các slide này sẽ bị ghi đè</li>
          <li>• Slide trống hoặc không có kịch bản sẽ được bỏ qua</li>
          <li>• Thao tác có thể mất vài phút tùy số lượng slide</li>
        </ul>
        <p className="mt-4 text-sm font-semibold leading-6 text-[#c62828]">
          Ước lượng {Number(creditEstimate || 0).toLocaleString("vi-VN")} credit
          {creditsAvailable != null
            ? ` · còn ${creditsAvailable.toLocaleString("vi-VN")}`
            : ""}
          . Audio cũ trên các slide này sẽ bị ghi đè.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-[#2bb673] px-4 py-2.5 text-sm font-bold text-[#083024]"
          >
            Tạo toàn bộ audio
          </button>
        </div>
      </div>
    </div>
  );
}

export function NoticeModal({
  open,
  title,
  message,
  confirmLabel = "Đã hiểu",
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="notice-modal-title"
          className="text-lg font-semibold text-[#0f2a36]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">{message}</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#2bb673] px-4 py-2.5 text-sm font-bold text-[#083024]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MicBatchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function ReplaceSlideMediaModal({
  open,
  slideLabel,
  busy,
  error,
  progress,
  onCancel,
  onUpload,
}: {
  open: boolean;
  slideLabel: string;
  busy?: boolean;
  error?: string | null;
  progress?: UploadProgressState | null;
  onCancel: () => void;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPickedName(null);
      setDragOver(false);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function takeFile(file: File | undefined | null) {
    if (!file || busy) return;
    setPickedName(file.name);
    onUpload(file);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="replace-slide-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="replace-slide-title"
          className="text-lg font-semibold text-[#0f2a36]"
        >
          Thay thế nội dung hiển thị
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
          Tải ảnh hoặc video mới để thay thế hình hiển thị của{" "}
          <span className="font-semibold text-[#1a2330]">{slideLabel}</span>.
        </p>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            takeFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
            dragOver
              ? "border-[#2f6fed] bg-[#eef4ff]"
              : "border-[#d5e1ea] bg-[#f7f9fb] hover:border-[#2f6fed]/50"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2f6fed] shadow-sm">
            <UploadIcon />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#1a2330]">
            Kéo thả file vào đây hoặc bấm để chọn
          </p>
          <p className="mt-1 text-xs text-[#6b7c8d]">
            Ảnh: PNG, JPG, WEBP, GIF · Video: MP4, WEBM, MOV
          </p>
          {pickedName ? (
            <p className="mt-3 text-xs font-medium text-[#2f6fed]">
              Đã chọn: {pickedName}
            </p>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="hidden"
          onChange={(e) => {
            takeFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {error ? (
          <p className="mt-3 text-sm font-medium text-[#b42318]">{error}</p>
        ) : null}
        {busy && progress ? (
          <div className="mt-4 text-left">
            <UploadProgressBar progress={progress} />
          </div>
        ) : busy ? (
          <p className="mt-3 text-sm font-medium text-[#2f6fed]">
            Đang tải lên và thay thế…
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full bg-[#e8eef5] px-4 py-2.5 text-sm font-semibold text-[#1a2330] disabled:opacity-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
