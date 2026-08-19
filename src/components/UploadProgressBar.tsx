"use client";

import { formatBytes } from "@/lib/format";
import type { UploadPhase } from "@/lib/upload-with-progress";

export type UploadProgressState = {
  label: string;
  fileName?: string;
  percent: number;
  loaded?: number;
  total?: number;
  phase: UploadPhase | "indeterminate";
};

export function UploadProgressBar({
  progress,
  tone = "light",
}: {
  progress: UploadProgressState;
  tone?: "light" | "dark";
}) {
  const indeterminate = progress.phase === "indeterminate";
  const saving = progress.phase === "saving";
  const width = indeterminate ? 0 : Math.min(100, Math.max(0, progress.percent));
  const sizeLabel =
    progress.total && progress.total > 0
      ? `${formatBytes(progress.loaded || 0)} / ${formatBytes(progress.total)}`
      : null;
  const status =
    indeterminate
      ? "Đang xử lý trên máy chủ…"
      : saving
        ? "Đã gửi xong, máy chủ đang lưu file…"
        : `Đang tải lên ${width}%`;

  const track = tone === "dark" ? "bg-white/15" : "bg-[#e8eef5]";
  const fill = tone === "dark" ? "bg-[#1aa86b]" : "bg-[#2bb673]";
  const title = tone === "dark" ? "text-white" : "text-[#0f2a36]";
  const sub = tone === "dark" ? "text-white/65" : "text-[#5b6b7c]";

  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : width}
      aria-valuetext={status}
      aria-label={progress.label}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className={`min-w-0 truncate text-sm font-semibold ${title}`}>
          {progress.label}
          {progress.fileName ? (
            <span className={`font-medium ${sub}`}> · {progress.fileName}</span>
          ) : null}
        </p>
        <p className={`shrink-0 text-xs font-semibold tabular-nums ${sub}`}>
          {indeterminate ? "…" : `${width}%`}
        </p>
      </div>
      <div className={`mt-2 h-2 overflow-hidden rounded-full ${track}`}>
        {indeterminate ? (
          <div className={`upload-progress-indet h-full rounded-full ${fill}`} />
        ) : (
          <div
            className={`h-full rounded-full ${fill} transition-[width] duration-150 ease-out`}
            style={{ width: `${saving ? 100 : width}%` }}
          />
        )}
      </div>
      <p className={`mt-1.5 text-xs ${sub}`}>
        {status}
        {sizeLabel && !indeterminate && !saving ? ` · ${sizeLabel}` : ""}
      </p>
    </div>
  );
}
