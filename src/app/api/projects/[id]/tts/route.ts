import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth/guest";
import { getSession } from "@/lib/auth/session";
import { saveProject } from "@/lib/db";
import {
  InsufficientCreditsError,
  assertCreditsAvailable,
  withCreditLock,
} from "@/lib/credits";
import { enqueueTtsJob, listActiveTtsJobs } from "@/lib/tts/queue";
import { DEFAULT_VOICE, estimateCredits } from "@/lib/tts/voices";
import { getTtsSettings } from "@/lib/tts/settings";
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

function creditErrorResponse(err: unknown) {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json(
      {
        error: err.message,
        needed: err.needed,
        available: err.available,
        topUpUrl: "/account/payments",
      },
      { status: 402 },
    );
  }
  return null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const access = await requireProjectAccess(req, id);
  if (access.error) return access.error;
  const project = access.project;
  const body = (await req.json()) as TtsBody;
  const provider = (body.provider === "mock" ? "mock" : "everai") as
    | "mock"
    | "everai";
  const settings = await getTtsSettings();
  const voice = body.voice || settings.defaultVoiceCode || DEFAULT_VOICE;
  const common = {
    projectId: id,
    voice,
    language: body.language,
    rate: body.rate,
    pitch: body.pitch,
    modelId: body.modelId,
    provider,
  };

  let ownerId: string | undefined;
  if (provider === "everai") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          error:
            "Đăng nhập và lưu dự án vào tài khoản để tạo audio AI. Mỗi lần tạo sẽ trừ credit.",
          topUpUrl: "/login",
        },
        { status: 401 },
      );
    }
    if (project.ownerId && project.ownerId !== session.userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền với dự án này." },
        { status: 403 },
      );
    }
    if (!project.ownerId) {
      project.ownerId = session.userId;
      project.guestClaimToken = null;
      await saveProject(project);
    }
    ownerId = session.userId;
  }

  if (body.all === true) {
    const targets = project.slides
      .filter((s): s is ContentSlide => s.type === "content")
      .filter((s) => !s.blank && Boolean(s.narrationScript?.trim()))
      .sort((a, b) => a.order - b.order);

    if (targets.length === 0) {
      return NextResponse.json(
        {
          error: "Không có slide nội dung nào có kịch bản để tạo audio.",
        },
        { status: 400 },
      );
    }

    try {
      const jobs = await withCreditLock(async () => {
        if (provider === "everai" && ownerId) {
          const active = await listActiveTtsJobs(id);
          const activeSlideIds = new Set(active.map((j) => j.slideId));
          const needed = targets
            .filter((slide) => !activeSlideIds.has(slide.id))
            .reduce(
              (sum, slide) =>
                sum +
                estimateCredits(slide.narrationScript.trim().length, voice),
              0,
            );
          await assertCreditsAvailable(ownerId, needed);
        }
        const queued = [];
        for (const slide of targets) {
          queued.push(
            await enqueueTtsJob({
              ...common,
              slideId: slide.id,
              ownerId,
              estimatedCredits:
                provider === "everai"
                  ? estimateCredits(slide.narrationScript.trim().length, voice)
                  : 0,
            }),
          );
        }
        return queued;
      });

      return NextResponse.json({
        jobs,
        queued: jobs.length,
        skipped:
          project.slides.filter((s) => s.type === "content").length -
          targets.length,
      });
    } catch (err) {
      const creditRes = creditErrorResponse(err);
      if (creditRes) return creditRes;
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "TTS thất bại" },
        { status: 500 },
      );
    }
  }

  const slideId = String(body.slideId || "");
  const slide = project.slides.find((s) => s.id === slideId);
  if (!slide || slide.type !== "content") {
    return NextResponse.json({ error: "Slide nội dung không hợp lệ." }, { status: 400 });
  }
  if (!slide.narrationScript?.trim()) {
    return NextResponse.json({ error: "Kịch bản lời thoại trống." }, { status: 400 });
  }

  const estimatedCredits =
    provider === "everai"
      ? estimateCredits(slide.narrationScript.trim().length, voice)
      : 0;

  try {
    const job = await withCreditLock(async () => {
      if (provider === "everai" && ownerId) {
        const active = await listActiveTtsJobs(id);
        const alreadyQueued = active.some((j) => j.slideId === slideId);
        if (!alreadyQueued) {
          await assertCreditsAvailable(ownerId, estimatedCredits);
        }
      }
      return enqueueTtsJob({
        ...common,
        slideId,
        ownerId,
        estimatedCredits,
      });
    });
    return NextResponse.json({ job });
  } catch (err) {
    const creditRes = creditErrorResponse(err);
    if (creditRes) return creditRes;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS thất bại" },
      { status: 500 },
    );
  }
}
