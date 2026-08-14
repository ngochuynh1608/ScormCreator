import fs from "fs/promises";
import path from "path";
import { getProject, saveProject } from "../db";
import { projectDir, projectThumbDir } from "../storage";
import { ensureLocalProjectFile } from "../object-storage";
import { parsePptxToSlides } from "../pptx/parse";
import { parsePdfToSlides } from "../pptx/pdf-parse";
import { collectPngThumbs, renderSlidesAsImages } from "../pptx/render";
import type { ContentSlide } from "../types";
import type { ConvertJobPayload } from "./types";

async function healThumbnails(projectId: string) {
  const project = await getProject(projectId);
  if (!project) return;

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
}

export async function processConvertJob(payload: ConvertJobPayload) {
  const { projectId, kind, mode } = payload;
  console.info(`[convert] start project=${projectId} mode=${mode} kind=${kind}`);

  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Không tìm thấy dự án ${projectId}`);
  }

  const originalName = kind === "pdf" ? "original.pdf" : "original.pptx";
  const sourceAbs = await ensureLocalProjectFile(projectId, originalName);

  try {
    if (mode === "ingest") {
      const buffer = await fs.readFile(sourceAbs);
      const slides =
        kind === "pdf"
          ? await parsePdfToSlides(projectId, buffer)
          : await parsePptxToSlides(projectId, buffer);

      const fresh = await getProject(projectId);
      if (!fresh) throw new Error("Dự án bị xóa trong lúc xử lý.");
      fresh.slides = slides;
      fresh.status = "ready";
      fresh.errorMessage = undefined;
      await saveProject(fresh);
      await import("../object-storage").then((m) =>
        m.syncProjectDirToObjectStorage(projectId).catch((err) => {
          console.warn("[convert] S3 sync:", err);
        }),
      );
    } else {
      const contentCount = project.slides.filter(
        (s) => s.type === "content",
      ).length;

      if (kind === "pdf") {
        const buf = await fs.readFile(sourceAbs);
        const slides = await parsePdfToSlides(projectId, buf);
        const fresh = await getProject(projectId);
        if (!fresh) throw new Error("Dự án bị xóa trong lúc xử lý.");
        const content = fresh.slides.filter(
          (s): s is ContentSlide => s.type === "content",
        );
        for (const slide of content) {
          const freshly = slides[slide.order];
          if (freshly?.thumbnailPath) {
            slide.thumbnailPath = freshly.thumbnailPath;
            slide.blank = false;
          }
        }
        fresh.status = "ready";
        fresh.errorMessage = undefined;
        await saveProject(fresh);
      } else {
        await renderSlidesAsImages(projectId, sourceAbs, contentCount);
        await healThumbnails(projectId);
        const fresh = await getProject(projectId);
        if (fresh) {
          fresh.status = "ready";
          fresh.errorMessage = undefined;
          await saveProject(fresh);
        }
      }
      await import("../object-storage").then((m) =>
        m.syncProjectDirToObjectStorage(projectId).catch((err) => {
          console.warn("[convert] S3 sync:", err);
        }),
      );
    }

    console.info(`[convert] done project=${projectId}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Xử lý file thất bại";
    console.error(`[convert] fail project=${projectId}`, message);
    const fresh = await getProject(projectId);
    if (fresh) {
      fresh.status = "error";
      fresh.errorMessage = message;
      await saveProject(fresh);
    }
    throw err;
  }
}
