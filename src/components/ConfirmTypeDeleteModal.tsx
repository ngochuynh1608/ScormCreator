"use client";

import { useEffect, useId, useRef, useState } from "react";

const REQUIRED_TEXT = "delete";

export function ConfirmTypeDeleteModal({
  open,
  title,
  description,
  confirmLabel = "Xóa",
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  const matched = typed.trim() === REQUIRED_TEXT;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) {
      setTyped("");
      return;
    }
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy]);

  if (!open) return null;

  function confirm() {
    if (!matched || busy) return;
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f2a36]/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-[#0f2a36]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">{description}</p>
        <p className="mt-4 text-sm leading-6 text-[#5b6b7c]">
          Nhập{" "}
          <span className="rounded-md bg-[#f3f7fa] px-1.5 py-0.5 font-mono text-[13px] font-semibold text-[#0f2a36]">
            {REQUIRED_TEXT}
          </span>{" "}
          để xác nhận. Thao tác này không thể hoàn tác.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          placeholder={REQUIRED_TEXT}
          aria-label={`Nhập ${REQUIRED_TEXT} để xác nhận xóa`}
          className="mt-3 w-full rounded-xl border border-[#c9d8e2] bg-white px-3 py-2.5 text-sm text-[#0f2a36] outline-none ring-[#e35d3d]/25 placeholder:text-[#9aabba] focus:border-[#e35d3d] focus:ring-2 disabled:opacity-50"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }}
        />
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
            onClick={confirm}
            disabled={busy || !matched}
            className="rounded-full bg-[#e35d3d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang xóa…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
