"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { v4 as uuidv4 } from "uuid";
import type {
  ContentSlide,
  Project,
  QuizOption,
  QuizQuestion,
  QuizSlide,
  ScormPlayerSettings,
  ScormVersion,
  Slide,
} from "@/lib/types";
import { createQuizQuestion, getQuizQuestions } from "@/lib/quiz";
import { getProjectScormSettings } from "@/lib/scorm/settings";
import {
  NarrationPanel,
  type TtsModelOption,
  type TtsVoiceOption,
} from "@/components/NarrationPanel";
import { estimateCreditsForText } from "@/lib/tts/voices";
import {
  ConfirmDeleteSlideModal,
  ConfirmGenerateAllAudioModal,
  NoticeModal,
  ReplaceSlideMediaModal,
} from "@/components/SlideModals";
import { AuthForm } from "@/components/AuthForm";
import { SlideStageView } from "@/components/SlideStageView";
import { UserMenu } from "@/components/UserMenu";
import {
  UploadProgressBar,
  type UploadProgressState,
} from "@/components/UploadProgressBar";
import { postFormData } from "@/lib/upload-with-progress";

function fileUrl(
  projectId: string,
  relative: string | null | undefined,
  bust?: string | number | null,
) {
  if (!relative) return null;
  const base = `/api/files/${projectId}/${relative}`;
  if (bust == null || bust === "") return base;
  return `${base}?v=${encodeURIComponent(String(bust))}`;
}

type TtsSlideUiStatus = {
  status: "loading" | "done" | "error";
  error?: string;
};

function slideHasThumb(slide: Slide): slide is ContentSlide {
  return slide.type === "content" && !slide.blank && Boolean(slide.thumbnailPath);
}

function SortableThumb({
  slide,
  index,
  active,
  onSelect,
  projectId,
  onRequestDelete,
  onRequestReplace,
  onRequestAddSlide,
  ttsStatus,
  loadThumb = true,
  onThumbSettled,
}: {
  slide: Slide;
  index: number;
  active: boolean;
  onSelect: () => void;
  projectId: string;
  onRequestDelete: () => void;
  onRequestReplace: () => void;
  onRequestAddSlide: () => void;
  ttsStatus?: TtsSlideUiStatus | null;
  loadThumb?: boolean;
  onThumbSettled?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: slide.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const thumb =
    slide.type === "content" && !slide.blank
      ? fileUrl(projectId, slide.thumbnailPath)
      : null;
  const hasVideo =
    slide.type === "content" && !slide.blank && Boolean(slide.videoPath);
  const isBlank = slide.type === "content" && Boolean(slide.blank);
  const [thumbReady, setThumbReady] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbSettledRef = useRef(false);
  const onThumbSettledRef = useRef(onThumbSettled);
  onThumbSettledRef.current = onThumbSettled;

  useEffect(() => {
    setThumbReady(false);
    setThumbFailed(false);
    thumbSettledRef.current = false;
  }, [thumb]);

  const settleThumb = useCallback(() => {
    if (thumbSettledRef.current) return;
    thumbSettledRef.current = true;
    onThumbSettledRef.current?.();
  }, []);

  const bindThumbImg = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) {
        setThumbReady(true);
        settleThumb();
      }
    },
    [settleThumb],
  );

  useEffect(() => {
    if (!loadThumb || !thumb || thumbReady) return;
    const t = window.setTimeout(() => settleThumb(), 8000);
    return () => window.clearTimeout(t);
  }, [loadThumb, thumb, thumbReady, settleThumb]);

  function openMenu() {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 156;
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8,
    );
    setMenuPos({ top: rect.bottom + 6, left });
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;

    function close() {
      setMenuOpen(false);
      setMenuPos(null);
    }

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (menuBtnRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      close();
    }

    function onScrollOrResize() {
      close();
    }

    // capture phase so DnD / other handlers không nuốt sự kiện
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menuOpen]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`slide-thumb-card ${active ? "is-active" : ""} ${
        slide.hidden ? "is-hidden" : ""
      }`}
    >
      <button
        ref={menuBtnRef}
        type="button"
        title="Tùy chọn slide"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="slide-thumb-menu"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (menuOpen) {
            setMenuOpen(false);
            setMenuPos(null);
          } else {
            openMenu();
          }
        }}
      >
        <KebabIcon />
      </button>

      {ttsStatus ? (
        <div
          className="absolute left-2 top-2 z-10"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <TtsStatusBadge status={ttsStatus} />
        </div>
      ) : null}

      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className="w-full cursor-grab border-0 bg-transparent p-0 text-left active:cursor-grabbing"
      >
        {slide.type === "quiz" ? (
          <div className="slide-thumb-media mb-2 flex flex-col items-center justify-center gap-1.5 bg-[#eef3f8]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f6fed] text-white">
              <QuizBubbleIcon />
            </span>
            <span className="text-xs font-semibold text-[#1a2330]">
              {slide.type === "quiz"
                ? `${getQuizQuestions(slide).length} Câu hỏi`
                : "1 Câu hỏi"}
            </span>
          </div>
        ) : isBlank ? (
          <div className="slide-thumb-media mb-2 flex flex-col items-center justify-center gap-1 bg-[#f3f6f9] text-[#6b7c8d]">
            <span className="text-2xl font-light">＋</span>
            <span className="text-xs font-semibold">Slide trống</span>
          </div>
        ) : thumb ? (
          <div className="slide-thumb-media mb-2">
            {!thumbReady ? (
              <div className="media-skeleton" aria-hidden />
            ) : null}
            {loadThumb && !thumbFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={bindThumbImg}
                src={thumb}
                alt=""
                draggable={false}
                decoding="async"
                onLoad={() => {
                  setThumbReady(true);
                  settleThumb();
                }}
                onError={() => {
                  setThumbFailed(true);
                  setThumbReady(true);
                  settleThumb();
                }}
                className={`transition-opacity duration-300 motion-reduce:transition-none ${
                  thumbReady ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : null}
          </div>
        ) : (
          <div className="slide-thumb-media mb-2 flex items-center justify-center bg-[#e8eef2] text-xs text-[#8a98a8]">
            Không có ảnh
          </div>
        )}

        <div className="mb-1 flex items-center justify-between gap-2 pr-8 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          <span>
            {slide.type === "quiz" ? "Quiz" : isBlank ? "Trống" : "Slide"}
          </span>
          <span>#{index + 1}</span>
        </div>
        <p className="line-clamp-2 pr-1 text-sm font-semibold text-[var(--panel)]">
          {slide.type === "quiz"
            ? slide.title ||
              getQuizQuestions(slide)[0]?.question ||
              "Câu hỏi"
            : isBlank
              ? "Chọn Tập tin hoặc Câu hỏi"
              : slide.title}
          {hasVideo ? (
            <span className="ml-1 text-[10px] font-bold uppercase text-[#2f6fed]">
              · Video
            </span>
          ) : null}
        </p>
      </button>

      {menuOpen && menuPos
        ? createPortal(
            <div
              ref={menuPanelRef}
              role="menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[200] min-w-[156px] overflow-hidden rounded-xl border border-[#e5ebf0] bg-white py-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[#1a2330] hover:bg-[#f3f6f9]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  setMenuPos(null);
                  onRequestDelete();
                }}
              >
                <TrashIcon />
                Xóa
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[#1a2330] hover:bg-[#f3f6f9]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  setMenuPos(null);
                  onRequestAddSlide();
                }}
              >
                <PlusIcon />
                Thêm slide
              </button>
              {slide.type === "content" && !slide.blank ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[#1a2330] hover:bg-[#f3f6f9]"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    setMenuPos(null);
                    onRequestReplace();
                  }}
                >
                  <ReplaceIcon />
                  Thay thế
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ProjectEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsBulk, setTtsBulk] = useState(false);
  const [ttsTargetSlideId, setTtsTargetSlideId] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exporting, setExporting] = useState<ScormVersion | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voiceCode, setVoiceCode] = useState("vi_female_kieunhi_mn");
  const [modelId, setModelId] = useState("everai-v1.6");
  const [voices, setVoices] = useState<TtsVoiceOption[]>([]);
  const [models, setModels] = useState<TtsModelOption[]>([]);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressState | null>(null);
  const [generateAllOpen, setGenerateAllOpen] = useState(false);
  const [generateAllCount, setGenerateAllCount] = useState(0);
  const [ttsSlideStatus, setTtsSlideStatus] = useState<
    Record<string, TtsSlideUiStatus>
  >({});
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [backgroundTts, setBackgroundTts] = useState<{
    active: number;
    running: number;
    queued: number;
  } | null>(null);
  const [cancellingTts, setCancellingTts] = useState(false);
  const [designBusy, setDesignBusy] = useState(false);
  const [creditGuest, setCreditGuest] = useState(false);
  const [creditsAvailable, setCreditsAvailable] = useState<number | null>(null);
  const [generateAllEstimate, setGenerateAllEstimate] = useState(0);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [slidesDrawerOpen, setSlidesDrawerOpen] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);
  const downloadPanelRef = useRef<HTMLDivElement | null>(null);
  const [downloadMenuPos, setDownloadMenuPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [thumbLoadStarted, setThumbLoadStarted] = useState(false);
  const [settledThumbs, setSettledThumbs] = useState<Set<string>>(
    () => new Set(),
  );
  const thumbQueueIds = useMemo(
    () => (project?.slides || []).filter(slideHasThumb).map((s) => s.id),
    [project],
  );

  useEffect(() => {
    setSettledThumbs(new Set());
    setThumbLoadStarted(false);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(
      () => setThumbLoadStarted(true),
      reduceMotion ? 0 : 80,
    );
    return () => window.clearTimeout(t);
  }, [projectId]);

  const nextThumbId = thumbLoadStarted
    ? thumbQueueIds.find((id) => !settledThumbs.has(id))
    : undefined;

  const onThumbSettled = useCallback((slideId: string) => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduceMotion ? 0 : 120;
    window.setTimeout(() => {
      setSettledThumbs((prev) => {
        if (prev.has(slideId)) return prev;
        const next = new Set(prev);
        next.add(slideId);
        return next;
      });
    }, delay);
  }, []);

  useEffect(() => {
    if (!slidesDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSlidesDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [slidesDrawerOpen]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không tải được dự án");
    setProject(data.project);
    setSelectedId((prev) => prev || data.project.slides[0]?.id || null);
    if (data.requiresAuth) setAuthGateOpen(true);
    else setAuthGateOpen(false);
  }, [projectId]);

  async function claimAfterAuth() {
    setClaiming(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/claim`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không gắn được dự án");
      setProject(data.project);
      setAuthGateOpen(false);
      setMessage("Đã lưu trình chiếu vào tài khoản của bạn.");
      await loadCredits();
    } catch (err) {
      setNotice({
        title: "Chưa lưu được vào tài khoản",
        message: err instanceof Error ? err.message : "Thử lại sau khi đăng nhập",
      });
    } finally {
      setClaiming(false);
    }
  }

  const loadTtsSettings = useCallback(async () => {
    const res = await fetch("/api/settings/tts");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không tải được cài đặt TTS");
    setApiConfigured(Boolean(data.configured));
    setApiKeyPreview(data.apiKeyPreview || "");
    setVoices(data.voices || []);
    setModels(data.models || []);
    if (data.defaultModelId) setModelId(data.defaultModelId);
    const list = (data.voices || []) as Array<{ code: string }>;
    const codes = new Set(list.map((v) => v.code));
    if (codes.size > 0) {
      const preferred =
        data.defaultVoiceCode && codes.has(data.defaultVoiceCode)
          ? data.defaultVoiceCode
          : list[0].code;
      setVoiceCode((cur) => (codes.has(cur) ? cur : preferred));
    } else if (data.defaultVoiceCode) {
      setVoiceCode(data.defaultVoiceCode);
    }
  }, []);

  const loadCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/wallet");
      const data = await res.json();
      if (!res.ok) return;
      if (data.guest) {
        setCreditGuest(true);
        setCreditsAvailable(null);
        return;
      }
      setCreditGuest(false);
      setCreditsAvailable(
        typeof data.wallet?.available === "number" ? data.wallet.available : 0,
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
    void loadTtsSettings().catch((e) => setMessage(e.message));
    void loadCredits();
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.id) {
          setUser({
            id: d.user.id,
            email: d.user.email || "",
            name: d.user.name || "",
          });
        }
      })
      .catch(() => {});
  }, [load, loadTtsSettings, loadCredits]);

  /** Poll while PPTX/PDF convert is queued or running on the worker. */
  useEffect(() => {
    if (project?.status !== "processing") return;
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(id);
  }, [project?.status, load]);

  const refreshBackgroundTts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/jobs?projectId=${encodeURIComponent(projectId)}`,
      );
      const data = await res.json();
      if (!res.ok) return;
      const active = Number(data.active || 0);
      if (active <= 0) {
        setBackgroundTts(null);
        return;
      }
      setBackgroundTts({
        active,
        running: Number(data.running || 0),
        queued: Number(data.queued || 0),
      });
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    void refreshBackgroundTts();
  }, [refreshBackgroundTts]);

  useEffect(() => {
    if (ttsBusy) {
      void refreshBackgroundTts();
    }
    const id = window.setInterval(() => {
      void refreshBackgroundTts();
    }, 4000);
    return () => window.clearInterval(id);
  }, [refreshBackgroundTts, ttsBusy]);

  async function cancelBackgroundTts() {
    setCancellingTts(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Không hủy được hàng đợi TTS");
      setBackgroundTts(null);
      setTtsBusy(false);
      setTtsBulk(false);
      setTtsTargetSlideId(null);
      setGenerateAllOpen(false);
      setTtsSlideStatus((prev) => {
        const next = { ...prev };
        for (const [id, st] of Object.entries(next)) {
          if (st.status === "loading") {
            next[id] = { status: "error", error: "Đã hủy tạo audio." };
          }
        }
        return next;
      });
      setNotice({
        title: "Đã dừng tạo audio",
        message: `Đã hủy ${data.cancelled || 0} job còn lại. Job đang gọi EverAI có thể vẫn bị trừ 1 lần nếu đã gửi request.`,
      });
      setMessage(`Đã hủy ${data.cancelled || 0} job TTS nền.`);
      await refreshBackgroundTts();
    } catch (err) {
      setNotice({
        title: "Không hủy được",
        message: err instanceof Error ? err.message : "Hủy TTS thất bại",
      });
    } finally {
      setCancellingTts(false);
    }
  }

  async function persistVoiceDefaults(nextVoice: string, nextModel: string) {
    setVoiceCode(nextVoice);
    setModelId(nextModel);
    if (!apiConfigured) return;
    await fetch("/api/settings/tts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultVoiceCode: nextVoice,
        defaultModelId: nextModel,
      }),
    }).catch(() => undefined);
  }

  const selected = useMemo(
    () => project?.slides.find((s) => s.id === selectedId) || null,
    [project, selectedId],
  );

  const scormSettings = useMemo(
    () => (project ? getProjectScormSettings(project) : null),
    [project],
  );

  const projectRef = useRef<Project | null>(null);
  projectRef.current = project;
  const persistTimerRef = useRef<number | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());

  async function persist(next: Project, options?: { immediate?: boolean }) {
    setProject(next);
    projectRef.current = next;

    const run = async () => {
      setSaving(true);
      try {
        const latest = projectRef.current || next;
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: latest.title,
            slides: latest.slides,
            scormSettings: latest.scormSettings,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lưu thất bại");
        // Keep local edits if user typed while request was in flight.
        if (projectRef.current === latest) {
          setProject(data.project);
          projectRef.current = data.project;
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Lưu thất bại");
      } finally {
        setSaving(false);
      }
    };

    if (options?.immediate) {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistChainRef.current = persistChainRef.current.then(run, run);
      await persistChainRef.current;
      return;
    }

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistChainRef.current = persistChainRef.current.then(run, run);
    }, 700);
  }

  function updateSelected(mutator: (slide: Slide) => Slide) {
    if (!project || !selected) return;
    const base = projectRef.current || project;
    const slides = base.slides.map((s) =>
      s.id === selected.id ? mutator(s) : s,
    );
    void persist({ ...base, slides });
  }

  function updateSelectedDesign(patch: Partial<ContentSlide>) {
    updateSelected((s) => {
      if (s.type !== "content") return s;
      return { ...s, ...patch };
    });
  }

  function saveScormSettings(next: ScormPlayerSettings) {
    if (!project) return;
    void persist({ ...project, scormSettings: next }, { immediate: true });
    setMessage("Đã lưu cài đặt SCORM.");
  }

  function onDragEnd(event: DragEndEvent) {
    if (!project) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = project.slides.findIndex((s) => s.id === active.id);
    const newIndex = project.slides.findIndex((s) => s.id === over.id);
    const slides = arrayMove(project.slides, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i,
    }));
    void persist({ ...project, slides }, { immediate: true });
  }

  async function addBlankSlideBelow(afterSlideId: string) {
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === afterSlideId);
    if (idx < 0) return;
    const blank: ContentSlide = {
      id: uuidv4(),
      type: "content",
      order: idx + 1,
      title: "Slide mới",
      bodyText: "",
      notes: "",
      narrationScript: "",
      audioPath: null,
      audioDurationMs: null,
      hidden: false,
      thumbnailPath: null,
      videoPath: null,
      blank: true,
      mediaFiles: [],
    };
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, blank);
    const next = {
      ...project,
      slides: slides.map((s, i) => ({ ...s, order: i })),
    };
    await persist(next, { immediate: true });
    setSelectedId(blank.id);
    setMessage("Đã thêm slide trống bên dưới.");
  }

  async function convertBlankToQuiz(
    slideId: string,
    quizType: "single" | "truefalse",
  ) {
    if (!project) return;
    // Ensure the blank slide exists on disk before replace (avoids persist race
    // after copy/manual folder clone or fast click).
    const latest = projectRef.current || project;
    await persist(latest, { immediate: true });

    const res = await fetch(`/api/projects/${projectId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replaceSlideId: slideId, quizType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Tạo câu hỏi thất bại");
      return;
    }
    setProject(data.project);
    setSelectedId(data.quizId);
    setMessage(
      quizType === "truefalse"
        ? "Đã tạo câu hỏi Đúng/Sai."
        : "Đã tạo câu hỏi trắc nghiệm.",
    );
  }

  async function uploadBlankMedia(slideId: string, file: File) {
    setReplaceBusy(true);
    setMessage("Đang tải media lên slide…");
    setUploadProgress({
      label: "Tải media lên slide",
      fileName: file.name,
      percent: 0,
      phase: "uploading",
    });
    try {
      const form = new FormData();
      form.append("slideId", slideId);
      form.append("file", file);
      const { ok, data } = await postFormData(
        `/api/projects/${projectId}/visual`,
        form,
        (p) =>
          setUploadProgress({
            label: "Tải media lên slide",
            fileName: file.name,
            percent: p.percent,
            loaded: p.loaded,
            total: p.total,
            phase: p.phase,
          }),
      );
      if (!ok) throw new Error(String(data.error || "Upload thất bại"));
      setProject(data.project as Project);
      setMessage(
        data.kind === "video"
          ? "Đã gắn video cho slide."
          : "Đã gắn ảnh cho slide.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload thất bại");
    } finally {
      setReplaceBusy(false);
      setUploadProgress(null);
    }
  }

  async function pollJob(jobId: string) {
    for (let i = 0; i < 90; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 2000));
      const jobRes = await fetch(`/api/jobs/${jobId}`);
      const jobData = await jobRes.json();
      const status = jobData.job?.status as string | undefined;
      if (status === "done")
        return jobData.job as {
          resultAudioPath?: string;
          resultDurationMs?: number;
          slideId?: string;
          errorMessage?: string;
        };
      if (status === "error" || status === "cancelled") {
        throw new Error(
          jobData.job?.errorMessage ||
            (status === "cancelled" ? "Đã hủy TTS" : "TTS lỗi"),
        );
      }
    }
    throw new Error("TTS quá lâu, thử lại.");
  }

  function setSlideTtsStatus(slideId: string, next: TtsSlideUiStatus) {
    setTtsSlideStatus((prev) => ({ ...prev, [slideId]: next }));
  }

  async function generateTts(scriptOverride?: string) {
    if (!selected || selected.type !== "content" || !project) return;
    const narration = (scriptOverride ?? selected.narrationScript ?? "").trim();
    if (!narration) {
      setMessage("Kịch bản lời thoại trống.");
      return;
    }
    if (!apiConfigured) {
      setMessage(
        "Hệ thống chưa cấu hình API key EverAI. Liên hệ admin để thiết lập.",
      );
      return;
    }

    // Always persist the exact script we will speak before enqueueing TTS,
    // so the job never reads a stale narrationScript (and PATCH can't race in).
    const nextProject: Project = {
      ...project,
      slides: project.slides.map((s) =>
        s.id === selected.id && s.type === "content"
          ? { ...s, narrationScript: narration }
          : s,
      ),
    };
    await persist(nextProject, { immediate: true });

    setTtsBusy(true);
    setTtsBulk(false);
    setTtsTargetSlideId(selected.id);
    setMessage("Đang tạo giọng đọc…");
    try {
      const res = await fetch(`/api/projects/${projectId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideId: selected.id,
          all: false,
          rate,
          pitch,
          language: "vi-VN",
          voice: voiceCode,
          modelId,
          provider: "everai",
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setAuthGateOpen(true);
      }
      if (!res.ok) throw new Error(data.error || "TTS thất bại");
      if (data.jobs) {
        throw new Error("Phản hồi TTS không hợp lệ (đã tạo hàng loạt). Thử lại.");
      }
      const jobId = data.job?.id as string | undefined;
      if (!jobId) throw new Error("Không nhận được job TTS.");
      const job = await pollJob(jobId);
      if (job.slideId && job.slideId !== selected.id) {
        throw new Error("TTS trả về sai slide. Thử lại.");
      }
      const audioPath = job.resultAudioPath || null;
      const audioDurationMs = job.resultDurationMs ?? null;
      const audioUpdatedAt = new Date().toISOString();
      const targetId = selected.id;
      if (audioPath) {
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            slides: prev.slides.map((s) =>
              s.id === targetId && s.type === "content"
                ? {
                    ...s,
                    audioPath,
                    audioDurationMs,
                    audioUpdatedAt,
                    narrationScript: narration,
                  }
                : s,
            ),
          };
        });
      }
      await load();
      await loadCredits();
      setMessage("Đã gán audio giọng đọc cho trang hiện tại");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "TTS thất bại");
    } finally {
      setTtsBusy(false);
      setTtsBulk(false);
      setTtsTargetSlideId(null);
    }
  }

  function requestGenerateAllTts() {
    if (!project) return;
    if (!apiConfigured) {
      setNotice({
        title: "Chưa cấu hình EverAI",
        message:
          "Hệ thống chưa có API key EverAI dùng chung. Admin cần cấu hình trong trang Quản trị → TTS.",
      });
      return;
    }
    if (creditGuest) {
      setAuthGateOpen(true);
      setNotice({
        title: "Cần đăng nhập",
        message:
          "Đăng nhập và lưu dự án vào tài khoản để tạo audio AI. Mỗi lần tạo sẽ trừ credit.",
      });
      return;
    }
    const targets = project.slides.filter(
      (s) =>
        s.type === "content" &&
        !s.blank &&
        Boolean(s.narrationScript?.trim()),
    );
    if (targets.length === 0) {
      setNotice({
        title: "Chưa có kịch bản",
        message:
          "Không có slide nội dung nào có kịch bản lời thoại. Nhập hoặc import DOCX trước, rồi thử lại.",
      });
      return;
    }
    const estimate = targets.reduce(
      (sum, s) =>
        sum +
        estimateCreditsForText(
          s.type === "content" ? s.narrationScript : "",
          modelId,
          rate,
        ),
      0,
    );
    if (creditsAvailable != null && creditsAvailable < estimate) {
      setNotice({
        title: "Không đủ credit",
        message: `Cần khoảng ${estimate.toLocaleString("vi-VN")} credit, bạn còn ${creditsAvailable.toLocaleString("vi-VN")}. Nạp thêm tại Tài khoản → Thanh toán.`,
      });
      return;
    }
    setGenerateAllCount(targets.length);
    setGenerateAllEstimate(estimate);
    setGenerateAllOpen(true);
  }

  async function generateAllTts() {
    if (!project) return;

    const targets = project.slides.filter(
      (s) =>
        s.type === "content" &&
        !s.blank &&
        Boolean(s.narrationScript?.trim()),
    );
    const loadingMap: Record<string, TtsSlideUiStatus> = {};
    for (const s of targets) {
      loadingMap[s.id] = { status: "loading" };
    }
    setTtsSlideStatus((prev) => ({ ...prev, ...loadingMap }));
    setGenerateAllOpen(false);

    setTtsBusy(true);
    setTtsBulk(true);
    setTtsTargetSlideId(null);
    setMessage(`Đang xếp hàng tạo audio cho ${targets.length} slide…`);
    try {
      const res = await fetch(`/api/projects/${projectId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          all: true,
          rate,
          pitch,
          language: "vi-VN",
          voice: voiceCode,
          modelId,
          provider: "everai",
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setAuthGateOpen(true);
      }
      if (!res.ok) throw new Error(data.error || "TTS hàng loạt thất bại");
      const jobs = (data.jobs || []) as { id: string; slideId: string }[];

      let done = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const job of jobs) {
        setTtsTargetSlideId(job.slideId);
        setSlideTtsStatus(job.slideId, { status: "loading" });
        setMessage(
          `Đang tạo audio… ${done + failed + 1}/${jobs.length}` +
            (failed ? ` · lỗi ${failed}` : ""),
        );
        try {
          await pollJob(job.id);
          done += 1;
          setSlideTtsStatus(job.slideId, { status: "done" });
        } catch (err) {
          failed += 1;
          const msg = err instanceof Error ? err.message : "TTS lỗi";
          errors.push(msg);
          setSlideTtsStatus(job.slideId, { status: "error", error: msg });
        }
      }

      await load();
      await loadCredits();
      if (failed === 0) {
        setNotice({
          title: "Tạo audio hoàn tất",
          message: `Đã tạo thành công audio EverAI cho ${done} slide.`,
        });
        setMessage(`Đã tạo audio cho ${done} slide.`);
      } else {
        setNotice({
          title: "Tạo audio có lỗi",
          message: `Hoàn tất: ${done} thành công, ${failed} lỗi. ${errors[0] || ""}`,
        });
        setMessage(
          `Hoàn tất: ${done} thành công, ${failed} lỗi. ${errors[0] || ""}`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "TTS hàng loạt thất bại";
      setTtsSlideStatus((prev) => {
        const next = { ...prev };
        for (const s of targets) {
          if (next[s.id]?.status === "loading") {
            next[s.id] = { status: "error", error: msg };
          }
        }
        return next;
      });
      setNotice({
        title: "Không tạo được audio",
        message: msg,
      });
      setMessage(msg);
    } finally {
      setTtsBusy(false);
      setTtsBulk(false);
      setTtsTargetSlideId(null);
    }
  }

  const generateAllVoiceLabel = useMemo(() => {
    const found = voices.find((v) => v.code === voiceCode);
    if (!found) return voiceCode;
    return `${found.name}${found.region ? ` · ${found.region}` : ""}`;
  }, [voices, voiceCode]);

  async function uploadAudio(file: File) {
    if (!selected || selected.type !== "content") return;
    setUploadProgress({
      label: "Tải audio lên",
      fileName: file.name,
      percent: 0,
      phase: "uploading",
    });
    try {
      const form = new FormData();
      form.append("slideId", selected.id);
      form.append("file", file);
      const { ok, data } = await postFormData(
        `/api/projects/${projectId}/audio`,
        form,
        (p) =>
          setUploadProgress({
            label: "Tải audio lên",
            fileName: file.name,
            percent: p.percent,
            loaded: p.loaded,
            total: p.total,
            phase: p.phase,
          }),
      );
      if (!ok) {
        setMessage(String(data.error || "Upload audio thất bại"));
        return;
      }
      setProject(data.project as Project);
      setMessage("Đã gắn audio tải lên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload audio thất bại");
    } finally {
      setUploadProgress(null);
    }
  }

  async function assignExistingAudio(audioPath: string) {
    if (!selected || selected.type !== "content") return;
    const res = await fetch(`/api/projects/${projectId}/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideId: selected.id, audioPath }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Gắn audio thất bại");
      return;
    }
    setProject(data.project);
    setMessage("Đã gắn audio có sẵn vào slide.");
  }

  async function importNarrationDocx(file: File) {
    setImportBusy(true);
    setMessage("Đang nhập lời thoại từ DOCX…");
    setUploadProgress({
      label: "Nhập lời thoại",
      fileName: file.name,
      percent: 0,
      phase: "uploading",
    });
    try {
      const form = new FormData();
      form.append("file", file);
      const { ok, data } = await postFormData(
        `/api/projects/${projectId}/narration-import`,
        form,
        (p) =>
          setUploadProgress({
            label: "Nhập lời thoại",
            fileName: file.name,
            percent: p.percent,
            loaded: p.loaded,
            total: p.total,
            phase: p.phase,
          }),
      );
      if (!ok) {
        throw new Error(String(data.error || "Nhập lời thoại thất bại"));
      }
      setProject(data.project as Project);
      const missing =
        Array.isArray(data.missing) && data.missing.length > 0
          ? ` · Bỏ qua slide không tồn tại: ${data.missing.join(", ")}`
          : "";
      setMessage(
        `Đã nhập lời thoại cho ${data.applied}/${data.rowCount} dòng${missing}.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nhập lời thoại thất bại");
    } finally {
      setImportBusy(false);
      setUploadProgress(null);
    }
  }

  useLayoutEffect(() => {
    if (!downloadOpen || exporting) {
      setDownloadMenuPos(null);
      return;
    }
    const rect = downloadBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDownloadMenuPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [downloadOpen, exporting]);

  useEffect(() => {
    if (!downloadOpen) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (downloadMenuRef.current?.contains(t)) return;
      if (downloadPanelRef.current?.contains(t)) return;
      setDownloadOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDownloadOpen(false);
    }
    function onReposition() {
      const rect = downloadBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDownloadMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [downloadOpen]);

  async function sharePreviewLink() {
    const url = `${window.location.origin}/projects/${projectId}/preview`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Đã copy link xem trước vào clipboard.");
    } catch {
      setNotice({
        title: "Link xem trước",
        message: url,
      });
    }
  }

  async function exportScorm(version: ScormVersion) {
    setExporting(version);
    setMessage(`Đang đóng gói SCORM ${version}…`);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Xuất SCORM thất bại");
      }
      const exportId = data.exportId as string;
      if (!exportId) throw new Error("Không nhận được mã job xuất.");

      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(
          `/api/projects/${projectId}/export?exportId=${encodeURIComponent(exportId)}`,
        );
        const statusData = await st.json().catch(() => ({}));
        if (!st.ok) {
          throw new Error(statusData.error || "Không kiểm tra được trạng thái xuất.");
        }
        if (statusData.status === "error") {
          throw new Error(statusData.errorMessage || "Xuất SCORM thất bại");
        }
        if (statusData.status === "done") break;
        setMessage(`Đang đóng gói SCORM ${version}…`);
      }

      const dl = await fetch(
        `/api/projects/${projectId}/export?exportId=${encodeURIComponent(exportId)}&download=1`,
      );
      if (!dl.ok) {
        const errBody = await dl.json().catch(() => ({}));
        throw new Error(errBody.error || "Tải file SCORM thất bại");
      }
      const blob = await dl.blob();
      if (!blob.size) throw new Error("File SCORM rỗng.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project?.title || "course").replace(/[\\/:*?"<>|]/g, "_")}_${version}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(
        `Đã tải SCORM ${version}. Giải nén ZIP rồi mở index.html (không mở trong ZIP).`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Xuất thất bại");
    } finally {
      setExporting(null);
    }
  }

  const deleteTarget = useMemo(
    () => project?.slides.find((s) => s.id === deleteTargetId) || null,
    [project, deleteTargetId],
  );
  const replaceTarget = useMemo(
    () => project?.slides.find((s) => s.id === replaceTargetId) || null,
    [project, replaceTargetId],
  );

  function slideLabel(slide: Slide | null) {
    if (!slide) return "slide này";
    const n = slide.order + 1;
    if (slide.type === "quiz") return `câu hỏi #${n}`;
    return `slide #${n}${slide.title ? ` (“${slide.title}”)` : ""}`;
  }

  async function confirmDeleteSlide() {
    if (!project || !deleteTarget) return;
    const slides = project.slides
      .filter((s) => s.id !== deleteTarget.id)
      .map((s, i) => ({ ...s, order: i }));
    const nextSelected =
      selectedId === deleteTarget.id
        ? slides[Math.max(0, deleteTarget.order - 1)]?.id ||
          slides[0]?.id ||
          null
        : selectedId;
    setDeleteTargetId(null);
    await persist({ ...project, slides }, { immediate: true });
    setSelectedId(nextSelected);
    setMessage("Đã xóa slide.");
  }

  async function uploadReplaceMedia(file: File) {
    if (!replaceTarget || replaceTarget.type !== "content") return;
    setReplaceBusy(true);
    setReplaceError(null);
    setUploadProgress({
      label: "Thay thế nội dung slide",
      fileName: file.name,
      percent: 0,
      phase: "uploading",
    });
    try {
      const form = new FormData();
      form.append("slideId", replaceTarget.id);
      form.append("file", file);
      const { ok, data } = await postFormData(
        `/api/projects/${projectId}/visual`,
        form,
        (p) =>
          setUploadProgress({
            label: "Thay thế nội dung slide",
            fileName: file.name,
            percent: p.percent,
            loaded: p.loaded,
            total: p.total,
            phase: p.phase,
          }),
      );
      if (!ok) throw new Error(String(data.error || "Thay thế thất bại"));
      setProject(data.project as Project);
      setReplaceTargetId(null);
      setMessage(
        data.kind === "video"
          ? "Đã thay thế slide bằng video."
          : "Đã thay thế ảnh hiển thị của slide.",
      );
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Thay thế thất bại");
    } finally {
      setReplaceBusy(false);
      setUploadProgress(null);
    }
  }

  async function uploadOverlayImage(file: File): Promise<string | null> {
    if (!selected || selected.type !== "content") return null;
    setDesignBusy(true);
    setUploadProgress({
      label: "Tải ảnh chèn lên",
      fileName: file.name,
      percent: 0,
      phase: "uploading",
    });
    try {
      const form = new FormData();
      form.append("slideId", selected.id);
      form.append("file", file);
      form.append("asOverlay", "1");
      const { ok, data } = await postFormData(
        `/api/projects/${projectId}/visual`,
        form,
        (p) =>
          setUploadProgress({
            label: "Tải ảnh chèn lên",
            fileName: file.name,
            percent: p.percent,
            loaded: p.loaded,
            total: p.total,
            phase: p.phase,
          }),
      );
      if (!ok) throw new Error(String(data.error || "Upload ảnh chèn thất bại"));
      setProject(data.project as Project);
      return (typeof data.relativePath === "string" && data.relativePath) || null;
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Upload ảnh chèn thất bại",
      );
      return null;
    } finally {
      setDesignBusy(false);
      setUploadProgress(null);
    }
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Đang tải dự án…
      </div>
    );
  }

  if (project.status === "processing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Link
          href="/dashboard"
          className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
        >
          Scorm Pro
        </Link>
        <h1 className="brand-font text-2xl font-semibold text-[var(--panel)]">
          Đang xử lý file
          <span className="loading-dots" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </h1>
        <div className="w-full max-w-sm">
          <UploadProgressBar
            progress={{
              label: "Máy chủ đang tách slide và tạo ảnh",
              percent: 0,
              phase: "indeterminate",
            }}
          />
        </div>
      </div>
    );
  }

  if (project.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="brand-font text-2xl font-semibold text-[var(--panel)]">
          Xử lý file thất bại
        </h1>
        <p className="max-w-md text-sm text-red-700">
          {project.errorMessage || "Không chuyển đổi được PPTX/PDF."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[#d7e2ea] bg-white px-4 py-2 text-sm font-semibold"
            onClick={() => {
              void (async () => {
                const res = await fetch(`/api/projects/${projectId}/rerender`, {
                  method: "POST",
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setMessage(data.error || "Thử lại thất bại");
                  return;
                }
                await load();
              })();
            }}
          >
            Thử render lại
          </button>
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Về danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="relative z-[60] border-b border-[#c9d8e2] bg-white/70 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                href="/dashboard"
                aria-label="Quay lại danh sách trình chiếu"
                title="Quay lại"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7e2ea] bg-white text-[#0f2a36] transition hover:bg-[#f4f7fa]"
              >
                <BackArrowIcon />
              </Link>
              <div className="min-w-0">
                <Link
                  href="/dashboard"
                  className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] transition hover:text-[#0f2a36]"
                >
                  Scorm Pro
                </Link>
                <input
                  className="brand-font mt-0.5 block w-full max-w-lg truncate border-0 bg-transparent text-base font-semibold outline-none md:text-xl"
                  value={project.title}
                  onChange={(e) => setProject({ ...project, title: e.target.value })}
                  onBlur={() =>
                    void persist(projectRef.current || project, { immediate: true })
                  }
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              {!project.ownerId ? (
                <button
                  type="button"
                  onClick={() => setAuthGateOpen(true)}
                  className="inline-flex h-9 items-center rounded-full border border-[#f0c36a] bg-[#fff6df] px-2.5 text-xs font-bold text-[#6a4b00]"
                >
                  Đăng nhập
                </button>
              ) : null}
              {user ? <UserMenu user={user} /> : null}
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {!project.ownerId ? (
              <button
                type="button"
                onClick={() => setAuthGateOpen(true)}
                className="hidden h-9 items-center rounded-full border border-[#f0c36a] bg-[#fff6df] px-3 text-xs font-bold text-[#6a4b00] md:inline-flex"
              >
                Đăng nhập để lưu
              </button>
            ) : null}
            <div
              className="inline-flex min-w-0 flex-1 items-center rounded-full border border-[#d7e2ea] bg-[#f4f7fa] p-1 md:flex-none"
              role="group"
              aria-label="Xem trước và chia sẻ"
            >
              <Link
                href={`/projects/${projectId}/preview`}
                title="Xem trước"
                className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-[#0f2a36] transition hover:bg-white hover:shadow-sm md:flex-none md:px-3"
              >
                <PreviewIcon />
                <span className="truncate">Xem trước</span>
              </Link>
              <span className="h-4 w-px shrink-0 bg-[#d7e2ea]" aria-hidden />
              <button
                type="button"
                title="Chia sẻ"
                onClick={() => void sharePreviewLink()}
                className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-[#0f2a36] transition hover:bg-white hover:shadow-sm md:flex-none md:px-3"
              >
                <ShareIcon />
                <span className="truncate">Chia sẻ</span>
              </button>
            </div>
            <div className="relative shrink-0" ref={downloadMenuRef}>
              <button
                ref={downloadBtnRef}
                type="button"
                disabled={!!exporting}
                aria-haspopup="menu"
                aria-expanded={downloadOpen && !exporting}
                onClick={() => setDownloadOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#2bb673] px-3 text-xs font-bold text-[#083024] shadow-sm transition hover:bg-[#24a366] disabled:opacity-50 md:px-3.5"
              >
                <DownloadIcon />
                {exporting ? (
                  <span>Đang xuất…</span>
                ) : (
                  <>
                    <span className="md:hidden">Xuất</span>
                    <span className="hidden md:inline">Xuất SCORM</span>
                  </>
                )}
                <ChevronDownIcon />
              </button>
              {downloadOpen && !exporting && downloadMenuPos
                ? createPortal(
                    <div
                      ref={downloadPanelRef}
                      role="menu"
                      style={{
                        top: downloadMenuPos.top,
                        right: downloadMenuPos.right,
                      }}
                      className="fixed z-[120] w-56 overflow-hidden rounded-2xl border border-[#e2e8ef] bg-white py-1 shadow-lg"
                    >
                      <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[#8a98a8]">
                        Gói học LMS
                      </p>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#f3f6f9]"
                        onClick={() => {
                          setDownloadOpen(false);
                          void exportScorm("1.2");
                        }}
                      >
                        <span className="mt-0.5 text-[#2bb673]">
                          <DownloadIcon />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#0f2a36]">
                            SCORM 1.2
                          </span>
                          <span className="block text-[11px] font-medium text-[#8a98a8]">
                            Phổ biến với hầu hết LMS
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#f3f6f9]"
                        onClick={() => {
                          setDownloadOpen(false);
                          void exportScorm("2004");
                        }}
                      >
                        <span className="mt-0.5 text-[#2bb673]">
                          <DownloadIcon />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#0f2a36]">
                            SCORM 2004
                          </span>
                          <span className="block text-[11px] font-medium text-[#8a98a8]">
                            Chuẩn mới hơn, hỗ trợ tốt hơn
                          </span>
                        </span>
                      </button>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
            {user ? (
              <div className="hidden shrink-0 md:block">
                <UserMenu user={user} />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {message ? (
        <p
          className={`px-4 py-2 text-sm ${
            /không đủ|lỗi|thất bại|invalid|không hợp lệ/i.test(message)
              ? "bg-[#5c2418] text-[#ffe8e0]"
              : "bg-[var(--panel)] text-[#d9f5e8]"
          }`}
        >
          {message}
          {saving ? " · Đang lưu…" : ""}
        </p>
      ) : null}

      <div className="editor-workspace">
        <button
          type="button"
          className="editor-slides-toggle"
          aria-expanded={slidesDrawerOpen}
          aria-controls="editor-slides-panel"
          onClick={() => setSlidesDrawerOpen(true)}
        >
          <SlidesRailIcon />
          <span>Slide</span>
          <span className="editor-slides-toggle-count">
            {project.slides.length}
          </span>
        </button>

        {slidesDrawerOpen ? (
          <button
            type="button"
            className="editor-slides-backdrop"
            aria-label="Đóng danh sách slide"
            onClick={() => setSlidesDrawerOpen(false)}
          />
        ) : null}

        <aside
          id="editor-slides-panel"
          className={`editor-slides space-y-2 ${
            slidesDrawerOpen ? "is-open" : ""
          }`}
        >
          <div className="editor-slides-drawer-head">
            <div>
              <p className="editor-slides-drawer-title">Danh sách slide</p>
              <p className="editor-slides-drawer-sub">
                {project.slides.length} slide
              </p>
            </div>
            <button
              type="button"
              className="editor-slides-drawer-close"
              aria-label="Đóng"
              onClick={() => setSlidesDrawerOpen(false)}
            >
              Đóng
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={project.slides.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {project.slides.map((slide, index) => (
                  <SortableThumb
                    key={slide.id}
                    projectId={projectId}
                    slide={slide}
                    index={index}
                    active={slide.id === selectedId}
                    ttsStatus={ttsSlideStatus[slide.id] || null}
                    loadThumb={
                      settledThumbs.has(slide.id) || slide.id === nextThumbId
                    }
                    onThumbSettled={() => onThumbSettled(slide.id)}
                    onSelect={() => {
                      setSelectedId(slide.id);
                      setSlidesDrawerOpen(false);
                    }}
                    onRequestDelete={() => {
                      setReplaceTargetId(null);
                      setDeleteTargetId(slide.id);
                    }}
                    onRequestReplace={() => {
                      setDeleteTargetId(null);
                      setReplaceError(null);
                      setReplaceTargetId(slide.id);
                    }}
                    onRequestAddSlide={() =>
                      void addBlankSlideBelow(slide.id)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>

        <section className="editor-main rounded-3xl bg-white p-4 shadow-sm">
          {!selected ? (
            <p className="text-[var(--muted)]">Chọn một slide để chỉnh sửa.</p>
          ) : selected.type === "content" ? (
            <ContentPanel
              projectId={projectId}
              slide={selected}
              uploading={replaceBusy}
              onChange={(patch) =>
                updateSelected((s) => ({ ...(s as ContentSlide), ...patch }))
              }
              onRemove={() => setDeleteTargetId(selected.id)}
              onUploadFile={(file) => void uploadBlankMedia(selected.id, file)}
              onChooseQuiz={(quizType) =>
                void convertBlankToQuiz(selected.id, quizType)
              }
            />
          ) : (
            <QuizPanel
              slide={selected}
              onChange={(patch) =>
                updateSelected((s) => ({ ...(s as QuizSlide), ...patch }))
              }
              onRemove={() => setDeleteTargetId(selected.id)}
            />
          )}
        </section>

        <div className="editor-narration">
        {selected?.type === "content" && !selected.blank ? (
            <NarrationPanel
              projectId={projectId}
              slide={selected}
              rate={rate}
              pitch={pitch}
              ttsBusy={ttsBusy || Boolean(backgroundTts && backgroundTts.active > 0)}
              ttsBusyForSlide={
                ttsBulk ||
                (ttsTargetSlideId != null && ttsTargetSlideId === selected.id)
              }
              ttsBusyOtherSlide={
                (ttsBusy || Boolean(backgroundTts && backgroundTts.active > 0)) &&
                !ttsBulk &&
                ttsTargetSlideId != null &&
                ttsTargetSlideId !== selected.id
              }
              voiceCode={voiceCode}
              modelId={modelId}
              voices={voices}
              models={models}
              apiConfigured={apiConfigured}
              apiKeyPreview={apiKeyPreview}
              scormSettings={scormSettings!}
              onScormSettingsChange={saveScormSettings}
              onRateChange={setRate}
              onPitchChange={setPitch}
              onVoiceChange={(code) => void persistVoiceDefaults(code, modelId)}
              onModelChange={(id) => void persistVoiceDefaults(voiceCode, id)}
              onScriptChange={(script) =>
                updateSelected((s) => ({
                  ...(s as ContentSlide),
                  narrationScript: script,
                }))
              }
              onGenerate={(text) => void generateTts(text)}
              onGenerateAll={() => requestGenerateAllTts()}
              onCancelTts={() => void cancelBackgroundTts()}
              cancellingTts={cancellingTts}
              onDesignChange={updateSelectedDesign}
              onUploadOverlayImage={uploadOverlayImage}
              designBusy={designBusy}
              onUploadAudio={(file) => void uploadAudio(file)}
              onAssignExistingAudio={(path) => void assignExistingAudio(path)}
              onImportNarrationDocx={(file) => void importNarrationDocx(file)}
              importBusy={importBusy}
              audioUrl={fileUrl(
                projectId,
                selected.audioPath,
                selected.audioUpdatedAt || selected.audioDurationMs,
              )}
              creditGuest={creditGuest}
              creditsAvailable={creditsAvailable}
            />
          ) : (
            <aside className="flex min-h-[320px] items-center justify-center rounded-[28px] bg-[#eef1f4] p-6 text-center text-sm text-[#6b7c8d]">
              {selected?.type === "content" && selected.blank
                ? "Chọn Tập tin hoặc Câu hỏi cho slide trống ở khung giữa."
                : "Chọn slide nội dung để nhập kịch bản và tạo giọng đọc AI."}
            </aside>
          )}
        </div>
      </div>

      <ConfirmDeleteSlideModal
        open={Boolean(deleteTarget)}
        slideLabel={slideLabel(deleteTarget)}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => void confirmDeleteSlide()}
      />
      <ConfirmGenerateAllAudioModal
        open={generateAllOpen && !ttsBusy}
        slideCount={generateAllCount}
        voiceLabel={generateAllVoiceLabel}
        creditEstimate={generateAllEstimate}
        creditsAvailable={creditsAvailable}
        onCancel={() => setGenerateAllOpen(false)}
        onConfirm={() => {
          setGenerateAllOpen(false);
          void generateAllTts();
        }}
      />
      {authGateOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-[#0f2a36]/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-auth-title"
        >
          <div className="w-full max-w-md">
            <p
              id="editor-auth-title"
              className="mb-3 text-center text-sm font-semibold text-white"
            >
              Đăng nhập hoặc tạo tài khoản để lưu trình chiếu vào tài khoản
            </p>
            {claiming ? (
              <div className="rounded-[28px] bg-white px-6 py-10 text-center shadow-xl">
                <p className="brand-font text-lg font-semibold text-[#0f2a36]">
                  Đang gắn dự án vào tài khoản…
                </p>
              </div>
            ) : (
              <AuthForm
                mode="signup"
                compact
                redirectOnSuccess={false}
                onSuccess={async () => {
                  await claimAfterAuth();
                }}
              />
            )}
            <button
              type="button"
              className="mt-3 w-full text-center text-sm font-semibold text-white/90 underline"
              disabled={claiming}
              onClick={() => setAuthGateOpen(false)}
            >
              Tiếp tục chỉnh sửa tạm (chưa đăng nhập)
            </button>
          </div>
        </div>
      ) : null}
      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title || ""}
        message={notice?.message || ""}
        onClose={() => setNotice(null)}
      />
      <ReplaceSlideMediaModal
        open={Boolean(replaceTarget && replaceTarget.type === "content")}
        slideLabel={slideLabel(replaceTarget)}
        busy={replaceBusy}
        error={replaceError}
        progress={replaceBusy ? uploadProgress : null}
        onCancel={() => {
          if (replaceBusy) return;
          setReplaceTargetId(null);
          setReplaceError(null);
        }}
        onUpload={(file) => void uploadReplaceMedia(file)}
      />
      {uploadProgress && !replaceTargetId ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] mx-auto w-auto max-w-md sm:inset-x-auto sm:right-6 sm:left-auto">
          <div className="pointer-events-auto rounded-2xl border border-[#d5e1ea] bg-white p-4 shadow-xl">
            <UploadProgressBar progress={uploadProgress} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContentPanel({
  projectId,
  slide,
  uploading,
  onChange,
  onRemove,
  onUploadFile,
  onChooseQuiz,
}: {
  projectId: string;
  slide: ContentSlide;
  uploading?: boolean;
  onChange: (patch: Partial<ContentSlide>) => void;
  onRemove: () => void;
  onUploadFile: (file: File) => void;
  onChooseQuiz: (quizType: "single" | "truefalse") => void;
}) {
  const [mode, setMode] = useState<"chooser" | "file" | "quiz">("chooser");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode("chooser");
  }, [slide.id]);

  if (slide.blank) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Slide trống
          </p>
          <h2 className="brand-font mt-1 text-2xl font-semibold text-[#0f2a36]">
            Chọn loại nội dung
          </h2>
          <p className="mt-2 text-sm text-[#5b6b7c]">
            Thêm tập tin (ảnh/video) hoặc tạo câu hỏi cho slide này.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-2xl border-2 p-5 text-left transition ${
              mode === "file"
                ? "border-[#2f6fed] bg-[#eef4ff]"
                : "border-[#e2e8ef] bg-white hover:border-[#2f6fed]/40"
            }`}
          >
            <p className="text-base font-semibold text-[#0f2a36]">Tập tin</p>
            <p className="mt-1 text-sm text-[#5b6b7c]">
              Tải lên hình ảnh hoặc video làm nội dung slide.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("quiz")}
            className={`rounded-2xl border-2 p-5 text-left transition ${
              mode === "quiz"
                ? "border-[#2f6fed] bg-[#eef4ff]"
                : "border-[#e2e8ef] bg-white hover:border-[#2f6fed]/40"
            }`}
          >
            <p className="text-base font-semibold text-[#0f2a36]">Câu hỏi</p>
            <p className="mt-1 text-sm text-[#5b6b7c]">
              Tạo câu hỏi trắc nghiệm hoặc đúng/sai.
            </p>
          </button>
        </div>

        {mode === "file" ? (
          <div className="rounded-2xl border border-dashed border-[#c9d8e2] bg-[#f7f9fb] p-6 text-center">
            <p className="text-sm font-semibold text-[#1a2330]">
              Tải ảnh hoặc video
            </p>
            <p className="mt-1 text-xs text-[#6b7c8d]">
              PNG, JPG, WEBP, GIF · MP4, WEBM, MOV
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="mt-4 rounded-full bg-[#2bb673] px-5 py-2.5 text-sm font-bold text-[#083024] disabled:opacity-50"
            >
              {uploading ? "Đang tải lên…" : "Chọn tệp"}
            </button>
          </div>
        ) : null}

        {mode === "quiz" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChooseQuiz("single")}
              className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#e2e8ef] hover:ring-[#2f6fed]"
            >
              <p className="font-semibold text-[#0f2a36]">Trắc nghiệm</p>
              <p className="mt-1 text-sm text-[#5b6b7c]">
                Một đáp án đúng trong nhiều lựa chọn.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onChooseQuiz("truefalse")}
              className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#e2e8ef] hover:ring-[#2f6fed]"
            >
              <p className="font-semibold text-[#0f2a36]">Đúng / Sai</p>
              <p className="mt-1 text-sm text-[#5b6b7c]">
                Câu hỏi khẳng định đúng hoặc sai.
              </p>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onRemove}
          className="rounded-full bg-[#f8e6dc] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
        >
          Xóa slide
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SlideStageView
        projectId={projectId}
        slide={slide}
        className="rounded-2xl"
      />
      <label className="block text-sm font-semibold">
        Tiêu đề
        <input
          className="mt-1 w-full rounded-xl border border-[#d5e1ea] px-3 py-2 font-normal"
          value={slide.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </label>
    </div>
  );
}

function QuizPanel({
  slide,
  onChange,
  onRemove,
}: {
  slide: QuizSlide;
  onChange: (patch: Partial<QuizSlide>) => void;
  onRemove: () => void;
}) {
  const questions: QuizQuestion[] = getQuizQuestions(slide);

  function updateQuestions(next: QuizQuestion[]) {
    onChange({ questions: next, title: slide.title || "Câu hỏi" });
  }

  function updateQuestion(questionId: string, patch: Partial<QuizQuestion>) {
    updateQuestions(
      questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block min-w-[200px] flex-1 text-sm font-semibold">
          Tiêu đề slide
          <input
            className="mt-1 w-full rounded-xl border border-[#d5e1ea] px-3 py-2 font-normal"
            value={slide.title || "Câu hỏi"}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {questions.length} câu hỏi
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((q, qIndex) => (
          <div
            key={q.id}
            className="space-y-3 rounded-2xl border border-[#e2e8ef] bg-[#f8fafc] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#0f2a36]">
                Câu {qIndex + 1} ·{" "}
                {q.quizType === "truefalse" ? "Đúng/Sai" : "Trắc nghiệm"}
              </p>
              {questions.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--danger)]"
                  onClick={() =>
                    updateQuestions(questions.filter((x) => x.id !== q.id))
                  }
                >
                  Xóa câu này
                </button>
              ) : null}
            </div>

            <label className="block text-sm font-semibold">
              Nội dung câu hỏi
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2 font-normal"
                value={q.question}
                onChange={(e) =>
                  updateQuestion(q.id, { question: e.target.value })
                }
              />
            </label>

            <div className="space-y-2">
              {q.options.map((opt: QuizOption, idx: number) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={opt.correct}
                    onChange={() =>
                      updateQuestion(q.id, {
                        options: q.options.map((o, i) => ({
                          ...o,
                          correct: i === idx,
                        })),
                      })
                    }
                  />
                  <input
                    className="flex-1 rounded-xl border border-[#d5e1ea] bg-white px-3 py-2"
                    value={opt.text}
                    onChange={(e) =>
                      updateQuestion(q.id, {
                        options: q.options.map((o) =>
                          o.id === opt.id ? { ...o, text: e.target.value } : o,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Feedback đúng
                <input
                  className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2 font-normal"
                  value={q.feedbackCorrect}
                  onChange={(e) =>
                    updateQuestion(q.id, { feedbackCorrect: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm font-semibold">
                Feedback sai
                <input
                  className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2 font-normal"
                  value={q.feedbackIncorrect}
                  onChange={(e) =>
                    updateQuestion(q.id, { feedbackIncorrect: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm font-semibold">
                Điểm
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2 font-normal"
                  value={q.points}
                  onChange={(e) =>
                    updateQuestion(q.id, { points: Number(e.target.value) })
                  }
                />
              </label>
              <label className="block text-sm font-semibold">
                Số lần thử tối đa (0 = không giới hạn)
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-[#d5e1ea] bg-white px-3 py-2 font-normal"
                  value={q.maxAttempts}
                  onChange={(e) =>
                    updateQuestion(q.id, {
                      maxAttempts: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            updateQuestions([...questions, createQuizQuestion("single")])
          }
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-[#d5e1ea]"
        >
          + Thêm trắc nghiệm
        </button>
        <button
          type="button"
          onClick={() =>
            updateQuestions([...questions, createQuizQuestion("truefalse")])
          }
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-[#d5e1ea]"
        >
          + Thêm Đúng/Sai
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={slide.gating}
          onChange={(e) => onChange({ gating: e.target.checked })}
        />
        Bắt buộc hoàn thành mọi câu hỏi mới qua slide tiếp
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full bg-[#f8e6dc] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
      >
        Xóa slide câu hỏi
      </button>
    </div>
  );
}

function TtsStatusBadge({ status }: { status: TtsSlideUiStatus }) {
  if (status.status === "loading") {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#0f2a36] shadow-sm"
        title="Đang tạo audio…"
        aria-label="Đang tạo audio"
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#c9d8e2] border-t-[#2bb673]" />
      </span>
    );
  }
  if (status.status === "done") {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f8ef] text-[#1f7a4d] shadow-sm"
        title="Đã tạo audio"
        aria-label="Đã tạo audio thành công"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fdecea] text-[#c62828] shadow-sm"
        aria-label={status.error || "Tạo audio thất bại"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 8v5M12 16.5h.01"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden max-w-[220px] rounded-lg bg-[#1a2330] px-2.5 py-1.5 text-xs font-medium leading-4 text-white shadow-lg group-hover:block"
      >
        {status.error || "Tạo audio thất bại"}
      </span>
    </span>
  );
}

function KebabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-1 0v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0 1 13.5-5.8M20 7V4m0 3h-3M20 12a8 8 0 0 1-13.5 5.8M4 17v3m0-3h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SlidesRailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="4"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="4"
        y="11"
        width="16"
        height="4"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="4"
        y="17"
        width="11"
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.3 10.8 15.7 6.2M8.3 13.2l7.4 4.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuizBubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 16.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.2c.9 0 1.5.5 1.5 1.3 0 .9-.6 1.2-1.2 1.5-.4.2-.6.4-.6.8V12.2M12 14.3h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
