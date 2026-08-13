import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth/guest";
import { saveProject } from "@/lib/db";
import { createQuizSlide } from "@/lib/quiz";
import type { QuizType } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const access = await requireProjectAccess(req, id);
  if (access.error) return access.error;
  const project = access.project;

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
    if (idx >= 0) {
      quiz.order = idx;
      quiz.id = replaceSlideId;
      project.slides[idx] = quiz;
    } else {
      // Blank existed only on the client (persist race / copied project out of sync).
      // Insert quiz instead of failing with "Không tìm thấy slide để thay thế."
      quiz.id = replaceSlideId;
      quiz.order = project.slides.length;
      project.slides = [...project.slides, quiz];
    }
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
