"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ConfirmDeleteSlideModal,
  NoticeModal,
} from "@/components/SlideModals";
import type { ContentSlide, Project } from "@/lib/types";

function fileUrl(projectId: string, relative: string | null | undefined) {
  if (!relative) return null;
  return `/api/files/${projectId}/${relative}`;
}

function firstSlideThumb(project: Project): string | null {
  const contents = (project.slides || []).filter(
    (s): s is ContentSlide => s.type === "content",
  );
  const withThumb =
    contents.find((s) => !s.blank && s.thumbnailPath) ||
    contents.find((s) => s.thumbnailPath);
  return fileUrl(project.id, withThumb?.thumbnailPath);
}

export function ProjectCard({
  project,
  onDeleted,
  onRenamed,
}: {
  project: Project;
  onDeleted: (id: string) => void;
  onRenamed?: (id: string, title: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const thumb = firstSlideThumb(project);

  useEffect(() => {
    if (!renaming) setDraftTitle(project.title);
  }, [project.title, renaming]);

  useEffect(() => {
    if (!renaming) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function sharePreview() {
    setMenuOpen(false);
    const url = `${window.location.origin}/projects/${project.id}/preview`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Đã copy link xem trước.");
    } catch {
      setNotice({ title: "Link xem trước", message: url });
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setDeleteOpen(false);
      onDeleted(project.id);
    } catch (err) {
      setNotice({
        title: "Không xóa được",
        message: err instanceof Error ? err.message : "Xóa thất bại",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function saveTitle() {
    const next = draftTitle.trim().slice(0, 120);
    if (!next) {
      setNotice({
        title: "Tên không hợp lệ",
        message: "Tên trình chiếu không được để trống.",
      });
      setDraftTitle(project.title);
      return;
    }
    if (next === project.title) {
      setRenaming(false);
      return;
    }
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Đổi tên thất bại");
      const savedTitle =
        typeof data.project?.title === "string" ? data.project.title : next;
      onRenamed?.(project.id, savedTitle);
      setDraftTitle(savedTitle);
      setRenaming(false);
      setToast("Đã đổi tên trình chiếu.");
    } catch (err) {
      setNotice({
        title: "Không đổi tên được",
        message: err instanceof Error ? err.message : "Đổi tên thất bại",
      });
    } finally {
      setSavingTitle(false);
    }
  }

  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-[#e2e8ef] bg-white shadow-sm transition hover:border-[#2bb673]/50 hover:shadow-md">
      <Link
        href={`/projects/${project.id}`}
        className="block"
        onClick={(e) => {
          if (renaming) e.preventDefault();
        }}
      >
        <div className="relative aspect-video bg-[#eef3f8]">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#8a98a8]">
              <span className="text-sm font-semibold">Chưa có ảnh slide</span>
            </div>
          )}
        </div>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
            {project.status === "ready"
              ? "Sẵn sàng"
              : project.status === "processing"
                ? "Đang xử lý"
                : project.status === "error"
                  ? "Lỗi"
                  : project.status}
          </p>
          {renaming ? (
            <div
              className="mt-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <input
                ref={titleInputRef}
                value={draftTitle}
                disabled={savingTitle}
                maxLength={120}
                aria-label="Tên trình chiếu"
                className="brand-font w-full rounded-xl border border-[#c9d8e2] bg-white px-3 py-2 text-lg font-semibold text-[#0f2a36] outline-none ring-[#2bb673]/35 focus:ring-2"
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveTitle();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDraftTitle(project.title);
                    setRenaming(false);
                  }
                }}
                onBlur={() => {
                  if (!savingTitle) void saveTitle();
                }}
              />
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-2">
              <p className="brand-font min-w-0 flex-1 line-clamp-2 text-lg font-semibold text-[#0f2a36]">
                {project.title}
              </p>
              <button
                type="button"
                title="Đổi tên trình chiếu"
                aria-label="Đổi tên trình chiếu"
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5b6b7c] opacity-70 transition hover:bg-[#eef3f8] hover:text-[#0f2a36] hover:opacity-100 group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  setDraftTitle(project.title);
                  setRenaming(true);
                }}
              >
                <PenIcon />
              </button>
            </div>
          )}
          <p className="mt-2 text-sm text-[#5b6b7c]">
            {project.slides?.length || 0} slide · Cập nhật{" "}
            {new Date(project.updatedAt).toLocaleString("vi-VN")}
          </p>
        </div>
      </Link>

      <div ref={menuRef} className="absolute right-3 top-3 z-10">
        <button
          type="button"
          title="Tùy chọn trình chiếu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d5e1ea] bg-white/95 text-[#0f2a36] shadow-sm backdrop-blur hover:bg-white"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <KebabIcon />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-[#dfe7ef] bg-white py-1 shadow-lg"
          >
            <Link
              role="menuitem"
              href={`/projects/${project.id}`}
              className="block px-4 py-2.5 text-sm font-semibold text-[#0f2a36] hover:bg-[#f3f7fa]"
              onClick={() => setMenuOpen(false)}
            >
              Chỉnh sửa
            </Link>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#0f2a36] hover:bg-[#f3f7fa]"
              onClick={() => {
                setMenuOpen(false);
                setDraftTitle(project.title);
                setRenaming(true);
              }}
            >
              Đổi tên
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#0f2a36] hover:bg-[#f3f7fa]"
              onClick={() => void sharePreview()}
            >
              Chia sẻ
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#c45c26] hover:bg-[#fff4ef]"
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              Xóa
            </button>
          </div>
        ) : null}
      </div>

      {toast ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl bg-[#0f2a36]/92 px-3 py-2 text-center text-xs font-semibold text-white">
          {toast}
        </div>
      ) : null}

      <ConfirmDeleteSlideModal
        open={deleteOpen}
        slideLabel={project.title}
        busy={deleting}
        title="Xóa trình chiếu?"
        confirmLabel="Xóa trình chiếu"
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => void confirmDelete()}
      />
      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title || ""}
        message={notice?.message || ""}
        onClose={() => setNotice(null)}
      />
    </article>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0 0-3L17.5 5a2.1 2.1 0 0 0-3 0L4 15.5V20z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
