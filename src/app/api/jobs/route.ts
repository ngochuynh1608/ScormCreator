import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { requireProjectAccess } from "@/lib/auth/guest";
import {
  cancelTtsJobs,
  listActiveTtsJobs,
  neutralizeStaleTtsJobs,
} from "@/lib/tts/queue";

export const runtime = "nodejs";

/** List active (queued/running) TTS jobs. Optional ?projectId= */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  if (projectId) {
    const access = await requireProjectAccess(req, projectId);
    if (access.error) return access.error;
  } else {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
  }
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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const result = await cancelTtsJobs();
    return NextResponse.json(result);
  }

  if (!body.projectId) {
    return NextResponse.json(
      { error: "Thiếu projectId." },
      { status: 400 },
    );
  }
  const access = await requireProjectAccess(req, body.projectId);
  if (access.error) return access.error;

  const result = await cancelTtsJobs({
    projectId: body.projectId,
    jobIds: body.jobIds,
  });
  return NextResponse.json(result);
}
