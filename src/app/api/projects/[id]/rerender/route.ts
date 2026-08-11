import fs from "fs/promises";
import path from "path";
import { getProject, saveProject } from "@/lib/db";
import { projectDir, projectThumbDir } from "@/lib/storage";
import { collectPngThumbs, renderSlidesAsImages } from "@/lib/pptx/render";
import type { ContentSlide } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 900;

type Ctx = { params: Promise<{ id: string }> };

/** Point slides at existing PNGs when metadata still references SVG fallbacks. */
async function healThumbnails(projectId: string) {
  const project = await getProject(projectId);
  if (!project) return null;

  const pngs = await collectPngThumbs(projectThumbDir(projectId));
  let changed = 0;
  const contentSlides = project.slides.filter(
    (s): s is ContentSlide => s.type === "content",
  );

  for (const slide of contentSlides) {
    const index = slide.order + 1;
    const pngRel = pngs[slide.order] || `thumbs/slide-${index}.png`;
    const abs = path.join(projectDir(projectId), pngRel);
    try {
      await fs.access(abs);
      if (slide.thumbnailPath !== pngRel) {
        slide.thumbnailPath = pngRel;
        changed += 1;
      }
    } catch {
      // keep current
    }
  }

  if (changed > 0) await saveProject(project);
  return { project, healed: changed, pngCount: pngs.filter(Boolean).length };
}

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) {
    return Response.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  }

  const dir = projectDir(id);
  const pptxAbs = path.join(dir, "original.pptx");
  const pdfAbs = path.join(dir, "original.pdf");
  let sourceAbs: string | null = null;
  let kind: "pptx" | "pdf" | null = null;
  try {
    await fs.access(pptxAbs);
    sourceAbs = pptxAbs;
    kind = "pptx";
  } catch {
    try {
      await fs.access(pdfAbs);
      sourceAbs = pdfAbs;
      kind = "pdf";
    } catch {
      return Response.json(
        { error: "Không tìm thấy file PPTX/PDF gốc." },
        { status: 400 },
      );
    }
  }

  const contentCount = project.slides.filter((s) => s.type === "content").length;

  try {
    if (kind === "pdf" && sourceAbs) {
      const { parsePdfToSlides } = await import("@/lib/pptx/pdf-parse");
      const buf = await fs.readFile(sourceAbs);
      const slides = await parsePdfToSlides(id, buf);
      // Keep non-content slides (quizzes) after regenerated content order remap is complex —
      // only refresh thumbs for existing content slides by order index.
      const content = project.slides.filter(
        (s): s is ContentSlide => s.type === "content",
      );
      for (const slide of content) {
        const freshly = slides[slide.order];
        if (freshly?.thumbnailPath) {
          slide.thumbnailPath = freshly.thumbnailPath;
          slide.blank = false;
        }
      }
      await saveProject(project);
    } else if (sourceAbs) {
      await renderSlidesAsImages(id, sourceAbs, contentCount);
    }
  } catch (err) {
    // Continue to heal whatever PNGs exist
    console.warn("[rerender]", err instanceof Error ? err.message : err);
  }

  const result = await healThumbnails(id);
  if (!result) {
    return Response.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  }

  return Response.json({
    project: result.project,
    healed: result.healed,
    pngCount: result.pngCount,
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await healThumbnails(id);
  if (!result) {
    return Response.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  }
  return Response.json({
    project: result.project,
    healed: result.healed,
    pngCount: result.pngCount,
  });
}
