import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireProjectAccess } from "@/lib/auth/guest";
import { requireSession } from "@/lib/auth/guards";
import { deleteProject, saveProject } from "@/lib/db";
import { projectDir, projectThumbDir } from "@/lib/storage";
import { collectPngThumbs } from "@/lib/pptx/render";
import type { ContentSlide, Project, QuizSlide, Slide } from "@/lib/types";
import { normalizeQuizSlide } from "@/lib/quiz";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function toClientProject(project: Project): Project {
  const { guestClaimToken: _t, ...rest } = project;
  return rest;
}

function normalizeProjectSlides(project: Project): Project {
  let changed = false;
  const slides = project.slides.map((s) => {
    if (s.type !== "quiz") return s;
    const quiz = s as QuizSlide;
    if (Array.isArray(quiz.questions) && quiz.questions.length > 0) return quiz;
    changed = true;
    return normalizeQuizSlide(quiz);
  });
  if (!changed) return project;
  return { ...project, slides };
}

async function healProjectThumbs(project: Project): Promise<Project> {
  const pngs = await collectPngThumbs(projectThumbDir(project.id));
  let changed = false;
  for (const slide of project.slides) {
    if (slide.type !== "content") continue;
    const content = slide as ContentSlide;

    if (content.thumbnailPath) {
      try {
        await fs.access(path.join(projectDir(project.id), content.thumbnailPath));
        continue;
      } catch {
        // fall through
      }
    }

    const pngRel =
      pngs[content.order] || `thumbs/slide-${content.order + 1}.png`;
    try {
      await fs.access(path.join(projectDir(project.id), pngRel));
      if (content.thumbnailPath !== pngRel) {
        content.thumbnailPath = pngRel;
        changed = true;
      }
    } catch {
      // keep current
    }
  }
  if (changed) return saveProject(project);
  return project;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const access = await requireProjectAccess(req, id);
  if (access.error) return access.error;
  let project = access.project;
  project = await healProjectThumbs(project);
  const normalized = normalizeProjectSlides(project);
  if (normalized !== project) {
    project = await saveProject(normalized);
  }
  return NextResponse.json({
    project: toClientProject(project),
    isGuest: access.isGuest,
    requiresAuth: access.isGuest || !access.session,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const access = await requireProjectAccess(req, id);
  if (access.error) return access.error;
  const project = access.project;
  const body = (await req.json()) as Partial<Project> & { slides?: Slide[] };
  if (typeof body.title === "string") project.title = body.title;
  if (body.scormSettings && typeof body.scormSettings === "object") {
    const { normalizeScormSettings } = await import("@/lib/scorm/settings");
    project.scormSettings = normalizeScormSettings(body.scormSettings);
  }
  if (Array.isArray(body.slides)) {
    const previousById = new Map(project.slides.map((s) => [s.id, s]));
    project.slides = body.slides.map((s, i) => {
      const ordered = { ...s, order: i };
      if (ordered.type === "quiz") {
        return normalizeQuizSlide(ordered as QuizSlide);
      }
      const content = ordered as ContentSlide;
      const prev = previousById.get(content.id);
      if (prev && prev.type === "content") {
        const prevAudioAt = prev.audioUpdatedAt || "";
        const nextAudioAt = content.audioUpdatedAt || "";
        if (prev.audioPath && prevAudioAt > nextAudioAt) {
          content.audioPath = prev.audioPath;
          content.audioDurationMs = prev.audioDurationMs;
          content.audioUpdatedAt = prev.audioUpdatedAt;
        }
      }
      return content;
    });
  }
  const saved = await saveProject(project);
  return NextResponse.json({
    project: toClientProject(saved),
    isGuest: access.isGuest,
    requiresAuth: access.isGuest || !access.session,
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const access = await requireProjectAccess(req, id);
  if (access.error) return access.error;
  if (!access.session || access.project.ownerId !== auth.session.userId) {
    return NextResponse.json(
      { error: "Chỉ chủ sở hữu mới được xóa dự án." },
      { status: 403 },
    );
  }
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
