"use client";

import { useCallback, useState } from "react";
import { UploadProgressBar, type UploadProgressState } from "@/components/UploadProgressBar";
import { postFormData } from "@/lib/upload-with-progress";

export function UploadZone() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "empty" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgressState | null>(null);

  const openEditor = (projectId: string) => {
    window.location.assign(`/projects/${projectId}`);
  };

  const upload = useCallback(async (file: File) => {
    setError(null);
    setBusy("upload");
    setProgress({
      label: "Tải file lên",
      fileName: file.name,
      percent: 0,
      phase: "uploading",
    });
    try {
      const form = new FormData();
      form.append("file", file);
      const { ok, data } = await postFormData("/api/upload", form, (p) =>
        setProgress({
          label: "Tải file lên",
          fileName: file.name,
          percent: p.percent,
          loaded: p.loaded,
          total: p.total,
          phase: p.phase,
        }),
      );
      if (!ok) throw new Error(String(data.error || "Upload thất bại"));
      const id = typeof data.project === "object" && data.project
        ? (data.project as { id?: string }).id
        : undefined;
      if (!id) throw new Error("Không nhận được dự án sau upload.");
      openEditor(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload thất bại");
      setBusy(null);
      setProgress(null);
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
            {busy === "upload" ? "Đang tải lên" : "Tải file .pptx / .pdf lên"}
          </span>
          <span className="mt-2 text-center text-sm text-[var(--muted)]">
            {busy === "upload"
              ? "Giữ cửa sổ này mở đến khi xong."
              : `Kéo thả hoặc bấm để chọn — tối đa ${process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 500}MB`}
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
      {busy === "upload" && progress ? (
        <div className="mt-4 rounded-2xl border border-[#d5e1ea] bg-white/90 p-4">
          <UploadProgressBar progress={progress} />
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-medium text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
