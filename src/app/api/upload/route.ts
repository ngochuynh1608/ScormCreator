import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth/session";
import {
  attachGuestClaimCookie,
  createGuestClaimToken,
} from "@/lib/auth/guest";
import {
  assertCanCreatePresentation,
  assertStorageAvailable,
  quotaLimitResponse,
} from "@/lib/auth/quota";
import { saveProject } from "@/lib/db";
import { ensureProjectDirs, projectDir } from "@/lib/storage";
import { putObjectFile } from "@/lib/object-storage";
import { enqueueConvertJob } from "@/lib/jobs/queues";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
/** Upload only stores the file and enqueues convert — keep short. */
export const maxDuration = 120;

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 500);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
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

    if (session) {
      try {
        await assertCanCreatePresentation(session.userId);
        await assertStorageAvailable(session.userId, file.size);
      } catch (err) {
        const limited = quotaLimitResponse(err);
        if (limited) return limited;
        throw err;
      }
    }

    const projectId = uuidv4();
    await ensureProjectDirs(projectId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = isPdf ? "original.pdf" : "original.pptx";
    const absOriginal = path.join(projectDir(projectId), originalName);
    await fs.writeFile(absOriginal, buffer);
    await putObjectFile(
      projectId,
      originalName,
      absOriginal,
      isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ).catch(() => undefined);

    const now = new Date().toISOString();
    const title =
      name.replace(/\.(pptx|pdf)$/i, "").trim() || "Bài giảng mới";

    const guestClaimToken = session ? null : createGuestClaimToken();
    const project: Project = {
      id: projectId,
      title,
      status: "processing",
      createdAt: now,
      updatedAt: now,
      originalFileName: name,
      slides: [],
      ownerId: session?.userId,
      guestClaimToken,
    };
    await saveProject(project);

    try {
      await enqueueConvertJob({
        projectId,
        kind: isPdf ? "pdf" : "pptx",
        mode: "ingest",
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 500;
      project.status = "error";
      project.errorMessage =
        err instanceof Error ? err.message : "Không xếp hàng xử lý được.";
      await saveProject(project);
      return NextResponse.json(
        { error: project.errorMessage, project: { ...project, guestClaimToken: undefined } },
        { status },
      );
    }

    const res = NextResponse.json(
      {
        project: { ...project, guestClaimToken: undefined },
        requiresAuth: !session,
      },
      { status: 201 },
    );
    if (guestClaimToken) {
      attachGuestClaimCookie(res, projectId, guestClaimToken);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
