import { NextRequest, NextResponse } from "next/server";
import {
  cancelTtsJobs,
  listActiveTtsJobs,
  neutralizeStaleTtsJobs,
} from "@/lib/tts/queue";

export const runtime = "nodejs";

/** List active (queued/running) TTS jobs. Optional ?projectId= */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  // On first hit after restart, kill stale silent jobs before listing.
  if (req.nextUrl.searchParams.get("neutralize") === "1") {
    await neutralizeStaleTtsJobs();
  }
  const jobs = await listActiveTtsJobs(projectId);
  return NextResponse.json({
    jobs,
    active: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    queued: jobs.filter((j) => j.status === "queued").length,
  });
}

/** Cancel active TTS jobs to stop further EverAI billing. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    jobIds?: string[];
    all?: boolean;
  };

  if (body.all) {
    const result = await cancelTtsJobs();
    return NextResponse.json(result);
  }

  const result = await cancelTtsJobs({
    projectId: body.projectId,
    jobIds: body.jobIds,
  });
  return NextResponse.json(result);
}
