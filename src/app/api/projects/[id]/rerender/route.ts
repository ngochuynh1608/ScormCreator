import fs from "fs/promises";
import path from "path";
import { getProject, saveProject } from "@/lib/db";
import { projectDir, projectThumbDir } from "@/lib/storage";
import { collectPngThumbs } from "@/lib/pptx/render";
import { enqueueConvertJob } from "@/lib/jobs/queues";
import type { ContentSlide } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  let kind: "pptx" | "pdf" | null = null;
  try {
    await fs.access(pptxAbs);
    kind = "pptx";
  } catch {
    try {
      await fs.access(pdfAbs);
      kind = "pdf";
    } catch {
      return Response.json(
        { error: "Không tìm thấy file PPTX/PDF gốc." },
        { status: 400 },
      );
    }
  }

  project.status = "processing";
  project.errorMessage = undefined;
  await saveProject(project);

  try {
    await enqueueConvertJob({
      projectId: id,
      kind: kind!,
      mode: "rerender",
    });
  } catch (err) {
    const status = (err as Error & { status?: number }).status || 500;
    project.status = "error";
    project.errorMessage =
      err instanceof Error ? err.message : "Không xếp hàng render được.";
    await saveProject(project);
    return Response.json({ error: project.errorMessage }, { status });
  }

  return Response.json({
    project,
    queued: true,
    message: "Đã xếp hàng render lại thumbnail.",
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
