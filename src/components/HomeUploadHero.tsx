"use client";

import { useCallback, useState } from "react";

const ACCEPT =
  ".pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf";

function isAllowedFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".pptx") || n.endsWith(".pdf");
}

/** Landing upload: always create draft → open editor (auth popup shows in editor). */
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
    <>
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
        className={`home-upload group relative mt-8 flex w-full max-w-xl cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[28px] border-2 border-dashed px-6 py-12 text-center transition duration-300 ${
          dragging
            ? "border-white bg-white/25 scale-[1.01]"
            : "border-white/45 bg-white/12 hover:border-white/80 hover:bg-white/18"
        } ${busy ? "pointer-events-none opacity-80" : ""}`}
      >
        <span className="home-upload-glow" aria-hidden />
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
        <span className="brand-font text-2xl font-semibold text-white md:text-3xl">
          {busy ? "Đang mở editor…" : "Tải lên PPTX hoặc PDF"}
        </span>
        <span className="mt-2 max-w-sm text-sm leading-6 text-white/80">
          Kéo thả hoặc bấm để chọn — tối đa{" "}
          {process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 500}MB
        </span>
      </label>
      {error ? (
        <p className="mt-3 text-sm font-semibold text-[#ffe0c2]">{error}</p>
      ) : null}
    </>
  );
}
