import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireOwnedProject } from "@/lib/auth/project-access";
import { saveProject } from "@/lib/db";
import { projectAudioDir, projectDir } from "@/lib/storage";
import type { ContentSlide, Project } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const AUDIO_EXT = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".wma",
  ".webm",
]);

function isSafeAudioRelative(rel: string) {
  const normalized = rel.replace(/\\/g, "/");
  if (!normalized.startsWith("audio/") || normalized.includes("..")) {
    return false;
  }
  return AUDIO_EXT.has(path.extname(normalized).toLowerCase());
}

function slidesUsingAudio(project: Project, audioPath: string) {
  return project.slides.filter(
    (s): s is ContentSlide =>
      s.type === "content" && s.audioPath === audioPath,
  );
}

async function unlinkIfOrphan(project: Project, projectId: string, rel: string | null) {
  if (!rel) return;
  if (slidesUsingAudio(project, rel).length > 0) return;
  await fs.unlink(path.join(projectDir(projectId), rel)).catch(() => undefined);
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const owned = await requireOwnedProject(id);
  if (owned.error) return owned.error;
  const project = owned.project;

  const dir = projectAudioDir(id);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    names = [];
  }

  const files = [];
  for (const name of names) {
    const ext = path.extname(name).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;
    const relativePath = `audio/${name}`;
    const abs = path.join(dir, name);
    let sizeBytes = 0;
    let mtimeMs = 0;
    try {
      const st = await fs.stat(abs);
      if (!st.isFile()) continue;
      sizeBytes = st.size;
      mtimeMs = st.mtimeMs;
    } catch {
      continue;
    }
    const usedBy = slidesUsingAudio(project, relativePath).map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
    }));
    files.push({
      relativePath,
      fileName: name,
      sizeBytes,
      mtimeMs,
      usedBy,
    });
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const owned = await requireOwnedProject(id);
  if (owned.error) return owned.error;
  const project = owned.project;

  const contentType = req.headers.get("content-type") || "";

  // Assign an existing file already in the project's audio/ folder.
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      slideId?: string;
      audioPath?: string;
    };
    const slideId = String(body.slideId || "");
    const audioPath = String(body.audioPath || "").replace(/\\/g, "/");
    const slide = project.slides.find((s) => s.id === slideId);
    if (!slide || slide.type !== "content") {
      return NextResponse.json({ error: "Slide không hợp lệ." }, { status: 400 });
    }
    if (!isSafeAudioRelative(audioPath)) {
      return NextResponse.json(
        { error: "Đường dẫn audio không hợp lệ." },
        { status: 400 },
      );
    }
    try {
      await fs.access(path.join(projectDir(id), audioPath));
    } catch {
      return NextResponse.json(
        { error: "Không tìm thấy file audio." },
        { status: 404 },
      );
    }

    const prevPath = slide.audioPath;
    slide.audioPath = audioPath;
    slide.audioDurationMs = null;
    slide.audioUpdatedAt = new Date().toISOString();
    const saved = await saveProject(project);
    if (prevPath && prevPath !== audioPath) {
      await unlinkIfOrphan(saved, id, prevPath);
    }
    return NextResponse.json({ project: saved, audioPath });
  }

  const form = await req.formData();
  const slideId = String(form.get("slideId") || "");
  const file = form.get("file");
  const slide = project.slides.find((s) => s.id === slideId);
  if (!slide || slide.type !== "content") {
    return NextResponse.json({ error: "Slide không hợp lệ." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file audio." }, { status: 400 });
  }

  const ext = path.extname(file.name || ".mp3") || ".mp3";
  const fileName = `${slideId}-${Date.now()}${ext}`;
  const abs = path.join(/*turbopackIgnore: true*/ projectAudioDir(id), fileName);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));

  const prevPath = slide.audioPath;
  slide.audioPath = `audio/${fileName}`;
  slide.audioDurationMs = null;
  slide.audioUpdatedAt = new Date().toISOString();
  const saved = await saveProject(project);

  if (prevPath && prevPath !== slide.audioPath) {
    await unlinkIfOrphan(saved, id, prevPath);
  }

  return NextResponse.json({ project: saved, audioPath: slide.audioPath });
}
