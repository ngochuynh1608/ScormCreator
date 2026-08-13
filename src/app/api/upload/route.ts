import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth/session";
import {
  attachGuestClaimCookie,
  createGuestClaimToken,
} from "@/lib/auth/guest";
import { assertCanCreatePresentation, presentationLimitResponse } from "@/lib/auth/quota";
import { saveProject } from "@/lib/db";
import { ensureProjectDirs, projectDir } from "@/lib/storage";
import { parsePptxToSlides } from "@/lib/pptx/parse";
import { parsePdfToSlides } from "@/lib/pptx/pdf-parse";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 900;

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 500);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session) {
      try {
        await assertCanCreatePresentation(session.userId);
      } catch (err) {
        const limited = presentationLimitResponse(err);
        if (limited) return limited;
        throw err;
      }
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Thiếu file PPTX hoặc PDF." },
        { status: 400 },
      );
    }
    const name = file.name || "deck.pptx";
    const lower = name.toLowerCase();
    const isPptx = lower.endsWith(".pptx");
    const isPdf = lower.endsWith(".pdf");
    if (!isPptx && !isPdf) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận file .pptx hoặc .pdf." },
        { status: 400 },
      );
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      return NextResponse.json(
        { error: `File vượt quá giới hạn ${MAX_MB}MB.` },
        { status: 400 },
      );
    }

    const projectId = uuidv4();
    await ensureProjectDirs(projectId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = isPdf ? "original.pdf" : "original.pptx";
    await fs.writeFile(path.join(projectDir(projectId), originalName), buffer);

    const slides = isPdf
      ? await parsePdfToSlides(projectId, buffer)
      : await parsePptxToSlides(projectId, buffer);

    const now = new Date().toISOString();
    const title =
      name.replace(/\.(pptx|pdf)$/i, "").trim() || "Bài giảng mới";

    const guestClaimToken = session ? null : createGuestClaimToken();
    const project: Project = {
      id: projectId,
      title,
      status: "ready",
      createdAt: now,
      updatedAt: now,
      originalFileName: name,
      slides,
      ownerId: session?.userId,
      guestClaimToken,
    };
    await saveProject(project);

    const res = NextResponse.json({
      project: { ...project, guestClaimToken: undefined },
      requiresAuth: !session,
    });
    if (guestClaimToken) {
      attachGuestClaimCookie(res, projectId, guestClaimToken);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
