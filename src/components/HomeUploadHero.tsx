"use client";

import { useCallback, useState } from "react";

const ACCEPT =
  ".pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf";

function isAllowedFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".pptx") || n.endsWith(".pdf");
}

/** Landing upload: create draft → open editor. */
export function HomeUploadHero() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload thất bại");
      const id = data.project?.id;
      if (!id) throw new Error("Không nhận được dự án sau upload.");
      window.location.assign(`/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload thất bại");
      setBusy(false);
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file || busy) return;
      if (!isAllowedFile(file)) {
        setError("Chỉ chấp nhận file .pptx hoặc .pdf.");
        return;
      }
      await uploadFile(file);
    },
    [busy, uploadFile],
  );

  return (
    <div className="home-cta mt-9 w-full max-w-lg">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`home-cta-drop group relative flex cursor-pointer flex-col gap-3 overflow-hidden border border-[#1a3a44] bg-[#0a1f28] px-6 py-5 text-left transition duration-300 md:flex-row md:items-center md:justify-between ${
          dragging
            ? "home-cta-drop-active scale-[1.01] border-[#1aa86b]"
            : "hover:border-[#1aa86b]"
        } ${busy ? "pointer-events-none opacity-80" : ""}`}
      >
        <span className="home-cta-sheen" aria-hidden />
        <input
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <span className="relative z-[1] min-w-0">
          <span className="block text-base font-semibold tracking-tight text-white md:text-lg">
            {busy ? "Đang mở editor…" : "Tải PPTX hoặc PDF"}
          </span>
          <span className="mt-1 block text-sm text-white/65">
            Kéo thả hoặc bấm chọn · tối đa{" "}
            {process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 500}MB
          </span>
        </span>
        <span className="relative z-[1] inline-flex shrink-0 items-center justify-center bg-[#1aa86b] px-4 py-2.5 text-sm font-bold text-[#042218] transition group-hover:bg-[#22c07a]">
          {busy ? "…" : "Bắt đầu"}
        </span>
      </label>
      {error ? (
        <p className="mt-3 text-sm font-semibold text-[#b5471d]">{error}</p>
      ) : null}
    </div>
  );
}
