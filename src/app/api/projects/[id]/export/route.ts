import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireOwnedProject } from "@/lib/auth/project-access";
import { packageScormZip } from "@/lib/scorm/package";
import type { ScormVersion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owned = await requireOwnedProject(id);
    if (owned.error) return owned.error;
    const project = owned.project;
    const body = await req.json().catch(() => ({}));
    const version: ScormVersion = body.version === "2004" ? "2004" : "1.2";
    const zipPath = await packageScormZip(project, version);
    const buf = await fs.readFile(zipPath);
    const fileName = path.basename(zipPath);
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
