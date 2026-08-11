import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Public read for shared preview links (no mutation). */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  }
  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      slides: project.slides,
      scormSettings: project.scormSettings,
      updatedAt: project.updatedAt,
    },
  });
}
