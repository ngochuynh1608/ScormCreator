"use client";

import { useCallback, useState } from "react";

export function UploadZone() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "empty" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openEditor = (projectId: string) => {
    window.location.assign(`/projects/${projectId}`);
  };

  const upload = useCallback(async (file: File) => {
    setError(null);
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload thất bại");
      openEditor(data.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload thất bại");
      setBusy(null);
    }
  }, []);

  const createEmpty = useCallback(async () => {
    setError(null);
    setBusy("empty");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Bài giảng mới" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo dự án thất bại");
      openEditor(data.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo dự án thất bại");
      setBusy(null);
    }
  }, []);

  const locked = busy !== null;

  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (locked) return;
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={`group flex min-h-[160px] flex-1 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 transition ${
            dragging
              ? "border-[var(--accent)] bg-white/80"
              : "border-[#9bb4c2] bg-white/55 hover:bg-white/80"
          } ${locked ? "pointer-events-none opacity-70" : ""}`}
        >
          <input
            type="file"
            accept=".pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
            className="hidden"
            disabled={locked}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span className="brand-font text-xl font-semibold text-[var(--panel)] sm:text-2xl">
            {busy === "upload" ? (
              <>
                Đang mở trang chỉnh sửa
                <span className="loading-dots" aria-hidden>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </>
            ) : (
              "Tải file .pptx / .pdf lên"
            )}
          </span>
          <span className="mt-2 text-center text-sm text-[var(--muted)]">
            Kéo thả hoặc bấm để chọn — tối đa{" "}
            {process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 500}MB
          </span>
        </label>

        <button
          type="button"
          disabled={locked}
          onClick={() => void createEmpty()}
          className="flex min-h-[160px] w-full shrink-0 flex-col items-center justify-center rounded-3xl border border-[#c9d8e2] bg-white/70 px-6 py-10 text-center transition hover:border-[#2bb673]/60 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-44"
        >
          <span className="brand-font text-lg font-semibold text-[var(--panel)]">
            {busy === "empty" ? (
              <>
                Đang tạo
                <span className="loading-dots" aria-hidden>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </>
            ) : (
              "Tạo trống"
            )}
          </span>
          <span className="mt-2 text-sm text-[var(--muted)]">
            Không cần file PPTX
          </span>
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm font-medium text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
