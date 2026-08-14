import { v4 as uuidv4 } from "uuid";
import { getProject, upsertJob, getJob, listJobs } from "../db";
import { getTtsSettings } from "./settings";
import { DEFAULT_VOICE } from "./voices";
import type { TtsJob } from "../types";
import { isRedisConfigured } from "../jobs/connection";
import { enqueueTtsBullJob } from "../jobs/queues";
import { processTtsJobById } from "../jobs/tts-processor";

let pumping = false;
const queue: string[] = [];
/** Jobs we must not call EverAI for (cancelled after enqueue). */
const cancelledIds = new Set<string>();

export function isTtsJobCancelled(jobId: string) {
  return cancelledIds.has(jobId);
}

export async function enqueueTtsJob(input: {
  projectId: string;
  slideId: string;
  voice?: string;
  language?: string;
  rate?: number;
  pitch?: number;
  modelId?: string;
  provider?: "everai" | "mock" | "auto";
  ownerId?: string;
  estimatedCredits?: number;
}): Promise<TtsJob> {
  const settings = await getTtsSettings();
  const now = new Date().toISOString();

  const existing = (await listJobs()).find(
    (j) =>
      j.projectId === input.projectId &&
      j.slideId === input.slideId &&
      (j.status === "queued" || j.status === "running"),
  );
  if (existing) {
    return existing;
  }

  const job: TtsJob = {
    id: uuidv4(),
    projectId: input.projectId,
    slideId: input.slideId,
    status: "queued",
    voice: input.voice || settings.defaultVoiceCode || DEFAULT_VOICE,
    language: input.language || "vi-VN",
    rate: input.rate ?? 1,
    pitch: input.pitch ?? 1,
    modelId: input.modelId || settings.defaultModelId,
    provider: input.provider || "everai",
    ownerId: input.ownerId,
    estimatedCredits:
      input.provider === "mock"
        ? 0
        : Math.max(0, Math.ceil(input.estimatedCredits || 0)),
    createdAt: now,
    updatedAt: now,
  };

  cancelledIds.delete(job.id);
  await upsertJob(job);

  if (isRedisConfigured()) {
    await enqueueTtsBullJob({ jobId: job.id });
  } else {
    queue.push(job.id);
    void pumpQueue();
  }
  return job;
}

export async function cancelTtsJobs(options?: {
  projectId?: string;
  jobIds?: string[];
}): Promise<{ cancelled: number }> {
  const jobs = await listJobs();
  const now = new Date().toISOString();
  let cancelled = 0;

  for (const job of jobs) {
    if (job.status !== "queued" && job.status !== "running") continue;
    if (options?.projectId && job.projectId !== options.projectId) continue;
    if (options?.jobIds && !options.jobIds.includes(job.id)) continue;

    cancelledIds.add(job.id);
    job.status = "cancelled";
    job.errorMessage = "Đã hủy để tránh trừ credit EverAI.";
    job.updatedAt = now;
    await upsertJob(job);
    cancelled += 1;
  }

  for (let i = queue.length - 1; i >= 0; i--) {
    if (cancelledIds.has(queue[i])) queue.splice(i, 1);
  }

  return { cancelled };
}

export async function listActiveTtsJobs(projectId?: string): Promise<TtsJob[]> {
  const jobs = await listJobs();
  return jobs.filter(
    (j) =>
      (j.status === "queued" || j.status === "running") &&
      (!projectId || j.projectId === projectId),
  );
}

async function pumpQueue() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const jobId = queue.shift()!;
      if (cancelledIds.has(jobId)) continue;
      await processTtsJobById(jobId, {
        isCancelled: () => cancelledIds.has(jobId),
      });
    }
  } finally {
    pumping = false;
  }
}

/**
 * Do NOT auto-resume unfinished jobs after restart of the web process.
 * Worker (BullMQ) owns durable TTS when Redis is configured.
 */
export async function neutralizeStaleTtsJobs() {
  if (isRedisConfigured()) {
    // Leave queued jobs for the worker; only clear in-memory leftovers.
    queue.length = 0;
    return { cancelled: 0 };
  }

  const jobs = await listJobs();
  const now = new Date().toISOString();
  let cancelled = 0;
  for (const job of jobs) {
    if (job.status !== "queued" && job.status !== "running") continue;
    cancelledIds.add(job.id);
    job.status = "cancelled";
    job.errorMessage =
      "Đã dừng job TTS còn mở từ phiên trước (tránh trừ credit âm thầm).";
    job.updatedAt = now;
    await upsertJob(job);
    cancelled += 1;
  }
  queue.length = 0;
  return { cancelled };
}

/** @deprecated use neutralizeStaleTtsJobs */
export async function resumeQueuedJobs() {
  return neutralizeStaleTtsJobs();
}

export { getJob, getProject };
