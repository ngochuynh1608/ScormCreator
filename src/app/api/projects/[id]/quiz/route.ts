import { NextRequest, NextResponse } from "next/server";
import { requireOwnedProject } from "@/lib/auth/project-access";
import { saveProject } from "@/lib/db";
import { createQuizSlide } from "@/lib/quiz";
import type { QuizType } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const owned = await requireOwnedProject(id);
  if (owned.error) return owned.error;
  const project = owned.project;

  const body = await req.json();
  const quizType: QuizType =
    body.quizType === "truefalse" ? "truefalse" : "single";
  const replaceSlideId =
    typeof body.replaceSlideId === "string" ? body.replaceSlideId : null;

  const quiz = createQuizSlide({
    id: replaceSlideId || undefined,
    quizType,
    gating: body.gating ?? true,
  });

  if (replaceSlideId) {
    const idx = project.slides.findIndex((s) => s.id === replaceSlideId);
    if (idx < 0) {
      return NextResponse.json(
        { error: "Không tìm thấy slide để thay thế." },
        { status: 404 },
      );
    }
    quiz.order = idx;
    quiz.id = replaceSlideId;
    project.slides[idx] = quiz;
  } else {
    const insertAt = Math.max(
      0,
      Math.min(
        Number(body.insertAt ?? project.slides.length),
        project.slides.length,
      ),
    );
    quiz.order = insertAt;
    const slides = [...project.slides];
    slides.splice(insertAt, 0, quiz);
    project.slides = slides;
  }

  project.slides = project.slides.map((s, i) => ({ ...s, order: i }));
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved, quizId: quiz.id });
}
