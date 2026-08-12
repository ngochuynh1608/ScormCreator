import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireOwnedProject } from "@/lib/auth/project-access";
import { saveProject } from "@/lib/db";
import { projectMediaDir, projectThumbDir } from "@/lib/storage";
import type { ContentSlide } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const owned = await requireOwnedProject(id);
  if (owned.error) return owned.error;
  const project = owned.project;

  const form = await req.formData();
  const slideId = String(form.get("slideId") || "");
  const file = form.get("file");
  const slide = project.slides.find((s) => s.id === slideId);

  if (!slide || slide.type !== "content") {
    return NextResponse.json(
      { error: "Chỉ thay thế được slide nội dung." },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file media." }, { status: 400 });
  }

  const originalName = file.name || "upload.bin";
  let ext = path.extname(originalName).toLowerCase();
  if (!ext && file.type.startsWith("image/")) {
    ext = `.${file.type.split("/")[1] || "png"}`;
  }
  if (!ext && file.type.startsWith("video/")) {
    ext = `.${file.type.split("/")[1] || "mp4"}`;
  }

  const isImage = IMAGE_EXTS.has(ext) || file.type.startsWith("image/");
  const isVideo = VIDEO_EXTS.has(ext) || file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json(
      {
        error:
          "Chỉ hỗ trợ ảnh (png/jpg/webp/gif) hoặc video (mp4/webm/mov).",
      },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const content = slide as ContentSlide;

  if (isImage) {
    if (!ext || !IMAGE_EXTS.has(ext)) ext = ".png";
    const asOverlay = String(form.get("asOverlay") || "") === "1";
    if (asOverlay) {
      const fileName = `overlay-${slideId}-${Date.now()}${ext}`;
      const abs = path.join(projectMediaDir(id), fileName);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);
      if (!content.mediaFiles.includes(fileName)) {
        content.mediaFiles = [...content.mediaFiles, fileName];
      }
      await saveProject(project);
      return NextResponse.json({
        project,
        slide: content,
        kind: "overlay",
        relativePath: `media/${fileName}`,
      });
    }
    const fileName = `${slideId}${ext}`;
    const abs = path.join(projectThumbDir(id), fileName);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
    content.thumbnailPath = `thumbs/${fileName}`;
    content.videoPath = null;
    content.blank = false;
  } else {
    if (!ext || !VIDEO_EXTS.has(ext)) ext = ".mp4";
    const fileName = `${slideId}${ext}`;
    const abs = path.join(projectMediaDir(id), fileName);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
    content.videoPath = `media/${fileName}`;
    content.blank = false;
    if (!content.mediaFiles.includes(fileName)) {
      content.mediaFiles = [...content.mediaFiles, fileName];
    }
  }

  await saveProject(project);
  return NextResponse.json({
    project,
    slide: content,
    kind: isImage ? "image" : "video",
  });
}
