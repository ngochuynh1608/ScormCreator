import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireOwnedProject } from "@/lib/auth/project-access";
import { getSession } from "@/lib/auth/session";
import {
  createExportJobRecord,
  getExportJob,
} from "@/lib/jobs/export-processor";
import { enqueueExportJob } from "@/lib/jobs/queues";
import { projectDir } from "@/lib/storage";
import { ensureLocalProjectFile } from "@/lib/object-storage";
import type { ScormVersion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Enqueue async SCORM export; poll GET ?exportId=… then download. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owned = await requireOwnedProject(id);
    if (owned.error) return owned.error;
    const body = await req.json().catch(() => ({}));
    const version: ScormVersion = body.version === "2004" ? "2004" : "1.2";
    const session = await getSession();

    const record = await createExportJobRecord({
      projectId: id,
      version,
      ownerId: session?.userId || owned.project.ownerId,
    });
    await enqueueExportJob({
      exportId: record.id,
      projectId: id,
      version,
      ownerId: record.ownerId,
    });

    return NextResponse.json({
      exportId: record.id,
      status: record.status,
      version,
    });
  } catch (err) {
    console.error("[scorm-export]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Xuất SCORM thất bại. Thử lại sau.",
      },
      { status: 500 },
    );
  }
}

/** Status poll or download finished ZIP: ?exportId=&download=1 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owned = await requireOwnedProject(id);
    if (owned.error) return owned.error;

    const exportId = req.nextUrl.searchParams.get("exportId");
    if (!exportId) {
      return NextResponse.json(
        { error: "Thiếu exportId." },
        { status: 400 },
      );
    }
    const job = await getExportJob(exportId);
    if (!job || job.projectId !== id) {
      return NextResponse.json(
        { error: "Không tìm thấy job xuất." },
        { status: 404 },
      );
    }

    const wantDownload = req.nextUrl.searchParams.get("download") === "1";
    if (!wantDownload) {
      return NextResponse.json({
        exportId: job.id,
        status: job.status,
        version: job.version,
        fileName: job.fileName,
        errorMessage: job.errorMessage,
      });
    }

    if (job.status !== "done" || !job.relativePath) {
      return NextResponse.json(
        { error: "File chưa sẵn sàng.", status: job.status },
        { status: 409 },
      );
    }

    const abs = await ensureLocalProjectFile(id, job.relativePath).catch(
      async () => path.join(projectDir(id), job.relativePath!),
    );
    const buf = await fs.readFile(abs);
    const fileName = job.fileName || path.basename(job.relativePath);
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(buf.length),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[scorm-export-get]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Tải SCORM thất bại.",
      },
      { status: 500 },
    );
  }
}
