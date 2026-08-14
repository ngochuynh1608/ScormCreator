import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { getProject, saveProject, upsertJob, getJob, listJobs } from "../db";
import { projectDir } from "../storage";
import { settleTtsDebit } from "../credits/wallet";
import { synthesizeEveraiSpeech } from "./everai";
import { getEveraiApiKey, getTtsSettings } from "./settings";
import { DEFAULT_VOICE, estimateCredits } from "./voices";
import type { ContentSlide, TtsJob } from "../types";

let pumping = false;
const queue: string[] = [];
/** Jobs we must not call EverAI for (cancelled after enqueue). */
const cancelledIds = new Set<string>();

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

  // Avoid stacking duplicate EverAI calls for the same slide while one is pending.
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
  queue.push(job.id);
  void pumpQueue();
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

  // Drop pending ids from the in-memory queue (running one may already have billed).
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
      await processJob(jobId);
    }
  } finally {
    pumping = false;
  }
}

async function applyAudioResult(
  projectId: string,
  slideId: string,
  result: { relativePath: string; durationMs: number },
) {
  const project = await getProject(projectId);
  if (!project) throw new Error("Không tìm thấy dự án.");
  const slide = project.slides.find((s) => s.id === slideId);
  if (!slide || slide.type !== "content") {
    throw new Error("Slide nội dung không tồn tại.");
  }
  const contentSlide = slide as ContentSlide;
  const prevPath = contentSlide.audioPath;
  contentSlide.audioPath = result.relativePath;
  contentSlide.audioDurationMs = result.durationMs;
  contentSlide.audioUpdatedAt = new Date().toISOString();
  await saveProject(project);

  if (prevPath && prevPath !== result.relativePath) {
    await fs
      .unlink(path.join(projectDir(projectId), prevPath))
      .catch(() => undefined);
  }
}

function wasCancelled(jobId: string, job: TtsJob) {
  return cancelledIds.has(jobId) || job.status === "cancelled";
}

async function processJob(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return;
  if (wasCancelled(jobId, job)) return;

  job.status = "running";
  job.updatedAt = new Date().toISOString();
  await upsertJob(job);

  try {
    // Re-check after marking running — cancel may arrive concurrently.
    if (cancelledIds.has(jobId)) {
      job.status = "cancelled";
      job.errorMessage = "Đã hủy để tránh trừ credit EverAI.";
      job.updatedAt = new Date().toISOString();
      await upsertJob(job);
      return;
    }

    const project = await getProject(job.projectId);
    if (!project) throw new Error("Không tìm thấy dự án.");
    const slide = project.slides.find((s) => s.id === job.slideId);
    if (!slide || slide.type !== "content") {
      throw new Error("Slide nội dung không tồn tại.");
    }
    const text = slide.narrationScript?.trim();
    if (!text) throw new Error("Kịch bản lời thoại trống.");

    if (job.provider === "mock") {
      const { synthesizeMockSpeech } = await import("./mock");
      const result = await synthesizeMockSpeech({
        projectId: job.projectId,
        slideId: job.slideId,
        text,
        rate: job.rate,
        pitch: job.pitch,
      });
      if (cancelledIds.has(jobId)) return;
      await applyAudioResult(job.projectId, job.slideId, result);
      job.status = "done";
      job.resultAudioPath = result.relativePath;
      job.resultDurationMs = result.durationMs;
      job.updatedAt = new Date().toISOString();
      await upsertJob(job);
      return;
    }

    const apiKey = await getEveraiApiKey();
    if (!apiKey) {
      throw new Error(
        "Chưa cấu hình API key EverAI. Admin cần thiết lập tại /admin.",
      );
    }

    // Last chance before billing EverAI.
    const fresh = await getJob(jobId);
    if (!fresh || fresh.status === "cancelled" || cancelledIds.has(jobId)) {
      job.status = "cancelled";
      job.errorMessage = "Đã hủy trước khi gọi EverAI.";
      job.updatedAt = new Date().toISOString();
      await upsertJob(job);
      return;
    }

    const result = await synthesizeEveraiSpeech({
      apiKey,
      projectId: job.projectId,
      slideId: job.slideId,
      text,
      voiceCode: job.voice,
      modelId: job.modelId,
      speedRate: job.rate,
      pitchRate: job.pitch,
    });

    if (cancelledIds.has(jobId)) {
      // Already billed by EverAI; still save audio so credit is not wasted.
    }

    await applyAudioResult(job.projectId, job.slideId, result);

    const billedOwner = job.ownerId || project.ownerId;
    if (billedOwner) {
      const credits =
        estimateCredits(result.durationMs, job.modelId) ||
        job.estimatedCredits ||
        0;
      await settleTtsDebit({
        userId: billedOwner,
        amount: credits,
        jobId: job.id,
      }).catch(() => undefined);
    }

    const latest = await getJob(jobId);
    if (latest?.status === "cancelled" || cancelledIds.has(jobId)) {
      // Keep cancelled label but attach result if file was saved.
      job.status = "cancelled";
      job.resultAudioPath = result.relativePath;
      job.resultDurationMs = result.durationMs;
      job.errorMessage =
        "Đã hủy sau khi EverAI tạo xong; audio vẫn được lưu để không phí credit.";
    } else {
      job.status = "done";
      job.resultAudioPath = result.relativePath;
      job.resultDurationMs = result.durationMs;
    }
    job.updatedAt = new Date().toISOString();
    await upsertJob(job);
  } catch (err) {
    if (cancelledIds.has(jobId)) {
      job.status = "cancelled";
      job.errorMessage = "Đã hủy để tránh trừ credit EverAI.";
    } else {
      job.status = "error";
      job.errorMessage = err instanceof Error ? err.message : "TTS thất bại";
    }
    job.updatedAt = new Date().toISOString();
    await upsertJob(job);
  }
}

/**
 * Do NOT auto-resume unfinished jobs after restart.
 * That silently re-billed EverAI while the UI looked idle.
 * Mark leftovers cancelled so nothing runs until the user clicks generate again.
 */
export async function neutralizeStaleTtsJobs() {
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

/** @deprecated use neutralizeStaleTtsJobs — kept as no-op alias to avoid silent rebill */
export async function resumeQueuedJobs() {
  return neutralizeStaleTtsJobs();
}
