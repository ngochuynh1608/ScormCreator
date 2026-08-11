import { NextRequest, NextResponse } from "next/server";
import { requireOwnedProject } from "@/lib/auth/project-access";
import { saveProject } from "@/lib/db";
import { parseNarrationDocx } from "@/lib/narration/docx-import";
import type { ContentSlide } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const owned = await requireOwnedProject(id);
  if (owned.error) return owned.error;
  const project = owned.project;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file DOCX." }, { status: 400 });
  }

  const name = (file.name || "").toLowerCase();
  if (!name.endsWith(".docx")) {
    return NextResponse.json(
      { error: "Chỉ hỗ trợ file .docx (Word)." },
      { status: 400 },
    );
  }

  let rows;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rows = await parseNarrationDocx(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Không đọc được file DOCX.",
      },
      { status: 400 },
    );
  }

  // Map by content-slide order (quiz ignored), 1-based Slide column.
  const contentSlides = project.slides
    .filter((s): s is ContentSlide => s.type === "content")
    .sort((a, b) => a.order - b.order);

  let applied = 0;
  const missing: number[] = [];
  const appliedSlides: { slideNumber: number; slideId: string; title: string }[] =
    [];

  for (const row of rows) {
    const target = contentSlides[row.slideNumber - 1];
    if (!target) {
      missing.push(row.slideNumber);
      continue;
    }
    target.narrationScript = row.content;
    applied += 1;
    appliedSlides.push({
      slideNumber: row.slideNumber,
      slideId: target.id,
      title: target.title,
    });
  }

  if (applied === 0) {
    return NextResponse.json(
      {
        error:
          "Không gắn được dòng nào. Số Slide trong file phải khớp số thứ tự slide nội dung.",
        missing,
        rowCount: rows.length,
        contentSlideCount: contentSlides.length,
      },
      { status: 400 },
    );
  }

  const saved = await saveProject(project);
  return NextResponse.json({
    project: saved,
    applied,
    missing,
    rowCount: rows.length,
    contentSlideCount: contentSlides.length,
    appliedSlides,
  });
}
