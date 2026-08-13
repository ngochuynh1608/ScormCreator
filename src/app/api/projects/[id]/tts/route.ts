import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth/guest";
import { enqueueTtsJob } from "@/lib/tts/queue";
import type { ContentSlide } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type TtsBody = {
  slideId?: string;
  all?: boolean;
  voice?: string;
  language?: string;
  rate?: number;
  pitch?: number;
  modelId?: string;
  provider?: string;
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const access = await requireProjectAccess(req, id);
  if (access.error) return access.error;
  const project = access.project;
  const body = (await req.json()) as TtsBody;
  const common = {
    projectId: id,
    voice: body.voice,
    language: body.language,
    rate: body.rate,
    pitch: body.pitch,
    modelId: body.modelId,
    provider: (body.provider === "mock" ? "mock" : "everai") as
      | "mock"
      | "everai",
  };

  if (body.all === true) {
    const targets = project.slides
      .filter((s): s is ContentSlide => s.type === "content")
      .filter((s) => !s.blank && Boolean(s.narrationScript?.trim()))
      .sort((a, b) => a.order - b.order);

    if (targets.length === 0) {
      return NextResponse.json(
        {
          error:
            "Không có slide nội dung nào có kịch bản để tạo audio.",
        },
        { status: 400 },
      );
    }

    const jobs = [];
    for (const slide of targets) {
      jobs.push(
        await enqueueTtsJob({
          ...common,
          slideId: slide.id,
        }),
      );
    }

    return NextResponse.json({
      jobs,
      queued: jobs.length,
      skipped:
        project.slides.filter((s) => s.type === "content").length -
        targets.length,
    });
  }

  const slideId = String(body.slideId || "");
  const slide = project.slides.find((s) => s.id === slideId);
  if (!slide || slide.type !== "content") {
    return NextResponse.json({ error: "Slide nội dung không hợp lệ." }, { status: 400 });
  }
  if (!slide.narrationScript?.trim()) {
    return NextResponse.json({ error: "Kịch bản lời thoại trống." }, { status: 400 });
  }

  const job = await enqueueTtsJob({
    ...common,
    slideId,
  });
  return NextResponse.json({ job });
}
