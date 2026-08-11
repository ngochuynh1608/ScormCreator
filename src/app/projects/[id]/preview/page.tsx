"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getQuizQuestions } from "@/lib/quiz";
import { getProjectScormSettings } from "@/lib/scorm/settings";
import type { Project, QuizQuestion, QuizSlide, Slide } from "@/lib/types";

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

function qKey(slideId: string, questionId: string) {
  return `${slideId}::${questionId}`;
}

export default function PreviewPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [feedbackByQ, setFeedbackByQ] = useState<
    Record<string, { text: string; bad: boolean }>
  >({});
  const [audioDone, setAudioDone] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioGateToken = useRef(0);

  useEffect(() => {
    void fetch(`/api/projects/${projectId}/public`)
      .then((r) => r.json())
      .then((d) => setProject(d.project));
  }, [projectId]);

  const settings = useMemo(
    () => (project ? getProjectScormSettings(project) : null),
    [project],
  );

  const slides = useMemo(
    () =>
      (project?.slides || [])
        .filter((s) => !s.hidden)
        .filter((s) => !(s.type === "content" && s.blank))
        .sort((a, b) => a.order - b.order),
    [project],
  );

  const slide: Slide | undefined = slides[index];
  const questions =
    slide?.type === "quiz" ? getQuizQuestions(slide as QuizSlide) : [];
  const quizGated =
    slide?.type === "quiz" &&
    slide.gating &&
    questions.some((q) => !answered[qKey(slide.id, q.id)]);

  const requireFullAudio = Boolean(settings?.requireFullAudio);
  const hasContentAudio =
    slide?.type === "content" && Boolean(slide.audioPath);
  const audioGated =
    requireFullAudio && hasContentAudio && !audioDone;
  const nextDisabled =
    index >= slides.length - 1 || quizGated || audioGated;

  useEffect(() => {
    const audio = audioRef.current;
    const token = ++audioGateToken.current;

    if (!audio) return;

    audio.pause();
    audio.removeAttribute("src");
    try {
      audio.load();
    } catch {
      // ignore
    }

    if (
      !slide ||
      slide.type !== "content" ||
      !slide.audioPath ||
      !requireFullAudio
    ) {
      setAudioDone(true);
      if (slide?.type === "content" && slide.audioPath) {
        const src =
          fileUrl(
            projectId,
            slide.audioPath,
            slide.audioUpdatedAt || slide.audioDurationMs,
          ) || "";
        audio.src = src;
        void audio.play().catch(() => undefined);
      }
      return;
    }

    setAudioDone(false);
    const src =
      fileUrl(
        projectId,
        slide.audioPath,
        slide.audioUpdatedAt || slide.audioDurationMs,
      ) || "";

    const onEnded = () => {
      if (token !== audioGateToken.current) return;
      setAudioDone(true);
    };
    // Only unlock on real media error after a source is assigned — not on clear/load.
    const onError = () => {
      if (token !== audioGateToken.current) return;
      if (!audio.getAttribute("src")) return;
      setAudioDone(true);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.src = src;
    void audio.play().catch(() => undefined);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [slide, projectId, requireFullAudio]);

  function goNext() {
    if (nextDisabled) return;
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }

  function submitQuestion(
    quiz: QuizSlide,
    question: QuizQuestion,
    form: HTMLFormElement,
  ) {
    const key = qKey(quiz.id, question.id);
    const selected = [
      ...form.querySelectorAll<HTMLInputElement>(
        `input[name="q-${question.id}"]:checked`,
      ),
    ].map((i) => i.value);
    const correct = question.options
      .filter((o) => o.correct)
      .map((o) => o.id)
      .sort()
      .join(",");
    const chosen = selected.slice().sort().join(",");
    const ok = correct === chosen && selected.length > 0;
    setAttempts((a) => ({ ...a, [key]: (a[key] || 0) + 1 }));
    if (ok) {
      if (!answered[key]) {
        setScore((s) => s + (question.points || 1));
        setAnswered((a) => ({ ...a, [key]: true }));
      }
      setFeedbackByQ((f) => ({
        ...f,
        [key]: { text: question.feedbackCorrect || "Chính xác!", bad: false },
      }));
      return;
    }
    setFeedbackByQ((f) => ({
      ...f,
      [key]: { text: question.feedbackIncorrect || "Chưa đúng.", bad: true },
    }));
    const maxA = question.maxAttempts || 0;
    if (maxA > 0 && (attempts[key] || 0) + 1 >= maxA) {
      setAnswered((a) => ({ ...a, [key]: true }));
    }
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1520] text-[#8aa0b2]">
        Đang tải preview…
      </div>
    );
  }

  const primary = settings?.buttonPrimary || "#3ddc97";
  const secondary = settings?.buttonSecondary || "#2a3a4a";
  const quizLight = settings?.quizTheme === "light";

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1520] text-[#edf3f7]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8aa0b2]">
            Preview học viên
            {requireFullAudio ? " · Bắt buộc nghe hết audio" : ""}
          </p>
          <Link
            href={`/projects/${projectId}`}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold"
          >
            Về editor
          </Link>
        </div>

        <div className="relative aspect-video max-h-[calc(100vh-120px)] min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-black">
          {!slide ? (
            <p className="p-8 text-[#8aa0b2]">Không có slide.</p>
          ) : slide.type === "content" ? (
            slide.videoPath ? (
              <video
                key={slide.videoPath}
                src={fileUrl(projectId, slide.videoPath) || undefined}
                poster={fileUrl(projectId, slide.thumbnailPath) || undefined}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl(projectId, slide.thumbnailPath) || undefined}
                alt={slide.title}
                className="h-full w-full object-contain"
              />
            )
          ) : (
            <div className="space-y-3 p-8">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8aa0b2]">
                Câu hỏi
              </p>
              <h2 className="brand-font text-2xl font-semibold">
                {slide.title || "Câu hỏi"}
              </h2>
              <p className="text-sm text-[#8aa0b2]">
                {questions.length} câu hỏi trong slide
              </p>
            </div>
          )}

          {slide?.type === "quiz" ? (
            <div
              className={`absolute inset-x-0 bottom-0 max-h-[55%] space-y-3 overflow-auto border-t p-4 ${
                quizLight
                  ? "border-[#d5e1ea] bg-[rgba(248,250,252,0.97)] text-[#0f2a36]"
                  : "border-white/10 bg-[rgba(10,18,28,0.94)] text-[#edf3f7]"
              }`}
            >
              {questions.map((q, qi) => {
                const key = qKey(slide.id, q.id);
                const fb = feedbackByQ[key];
                return (
                  <form
                    key={q.id}
                    className={`space-y-2 border-b pb-3 last:border-0 ${
                      quizLight ? "border-[#e2e8ef]" : "border-white/10"
                    }`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitQuestion(slide, q, e.currentTarget);
                    }}
                  >
                    <p className="text-sm font-bold">
                      Câu {qi + 1}. {q.question}
                    </p>
                    {q.options.map((o: { id: string; text: string }) => (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ${
                          quizLight ? "bg-[#0f2a36]/06" : "bg-white/10"
                        }`}
                      >
                        <input type="radio" name={`q-${q.id}`} value={o.id} />
                        <span>{o.text}</span>
                      </label>
                    ))}
                    <button
                      type="submit"
                      className="rounded-full px-4 py-2 text-sm font-semibold text-[#083024]"
                      style={{ background: primary }}
                    >
                      Gửi đáp án
                    </button>
                    {fb ? (
                      <p
                        className={`text-sm ${
                          fb.bad
                            ? quizLight
                              ? "text-[#c45c26]"
                              : "text-[#ffd2b3]"
                            : quizLight
                              ? "text-[#1a5c40]"
                              : "text-[#b7f5d6]"
                        }`}
                      >
                        {fb.text}
                      </p>
                    ) : null}
                  </form>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-b-2xl bg-[#121f2c] px-3 py-2.5 max-md:grid-cols-1">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: secondary }}
          >
            Trước
          </button>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#8aa0b2]">
              <strong className="truncate text-[#d7e6ef]">{project.title}</strong>
              <span>
                {slides.length ? index + 1 : 0}/{slides.length} · Điểm {score}
              </span>
            </div>
            <audio ref={audioRef} controls className="h-9 w-full" />
            {audioGated ? (
              <p className="text-[11px] font-medium text-[#f0c67a]">
                Nghe hết audio để mở nút Tiếp.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={nextDisabled}
            onClick={goNext}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#083024] disabled:opacity-40"
            style={{ background: primary }}
          >
            Tiếp
          </button>
        </div>
      </div>
    </div>
  );
}
