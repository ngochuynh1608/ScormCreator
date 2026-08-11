import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { projectDir } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; path: string[] }> };

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".json": "application/json",
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id, path: parts } = await ctx.params;
  const relative = parts.map(decodeURIComponent).join("/");
  if (relative.includes("..")) {
    return NextResponse.json({ error: "Đường dẫn không hợp lệ." }, { status: 400 });
  }
  const abs = path.join(projectDir(id), relative);
  try {
    const buf = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const isAudio = [".mp3", ".wav", ".ogg", ".m4a"].includes(ext);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        // Audio is often overwritten by TTS; avoid sticky cached previous voice.
        "Cache-Control": isAudio
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy file." }, { status: 404 });
  }
}
