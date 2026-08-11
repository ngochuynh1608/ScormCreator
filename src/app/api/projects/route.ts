import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireSession } from "@/lib/auth/guards";
import { listProjects, saveProject } from "@/lib/db";
import { ensureProjectDirs } from "@/lib/storage";
import type { ContentSlide, Project } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const projects = await listProjects(auth.session.userId);
  return NextResponse.json({ projects });
}

/** Create an empty presentation (no PPTX). */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  let title = "Bài giảng mới";
  try {
    const body = (await req.json()) as { title?: string };
    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 120);
    }
  } catch {
    // empty body is fine
  }

  const projectId = uuidv4();
  await ensureProjectDirs(projectId);
  const now = new Date().toISOString();
  const blank: ContentSlide = {
    id: uuidv4(),
    type: "content",
    order: 0,
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

  const project: Project = {
    id: projectId,
    title,
    status: "ready",
    createdAt: now,
    updatedAt: now,
    originalFileName: "",
    slides: [blank],
    ownerId: auth.session.userId,
  };
  await saveProject(project);
  return NextResponse.json({ project });
}
