import fs from "fs/promises";
import path from "path";
import { getProject, saveProject, upsertJob, getJob } from "../db";
import { projectDir } from "../storage";
import { settleTtsDebit } from "../credits/wallet";
import { synthesizeEveraiSpeech } from "../tts/everai";
import { getEveraiApiKey } from "../tts/settings";
import { estimateCredits } from "../tts/voices";
import type { ContentSlide, TtsJob } from "../types";
import { syncProjectDirToObjectStorage } from "../object-storage";

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

async function checkCancelled(
  jobId: string,
  extra?: () => boolean | Promise<boolean>,
) {
  if (extra && (await extra())) return true;
  const latest = await getJob(jobId);
  return !latest || latest.status === "cancelled";
}

/** Process a single TTS job by id (used by BullMQ worker and in-process pump). */
export async function processTtsJobById(
  jobId: string,
  options?: { isCancelled?: () => boolean | Promise<boolean> },
) {
  const job = await getJob(jobId);
  if (!job) return;
  if (await checkCancelled(jobId, options?.isCancelled)) return;

  job.status = "running";
  job.updatedAt = new Date().toISOString();
  await upsertJob(job);

  try {
    if (await checkCancelled(jobId, options?.isCancelled)) {
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
      const { synthesizeMockSpeech } = await import("../tts/mock");
      const result = await synthesizeMockSpeech({
        projectId: job.projectId,
        slideId: job.slideId,
        text,
        rate: job.rate,
        pitch: job.pitch,
      });
      if (await checkCancelled(jobId, options?.isCancelled)) return;
      await applyAudioResult(job.projectId, job.slideId, result);
      job.status = "done";
      job.resultAudioPath = result.relativePath;
      job.resultDurationMs = result.durationMs;
      job.updatedAt = new Date().toISOString();
      await upsertJob(job);
      await syncProjectDirToObjectStorage(job.projectId).catch(() => undefined);
      return;
    }

    const apiKey = await getEveraiApiKey();
    if (!apiKey) {
      throw new Error(
        "Chưa cấu hình API key EverAI. Admin cần thiết lập tại /admin.",
      );
    }

    if (await checkCancelled(jobId, options?.isCancelled)) {
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

    if (await checkCancelled(jobId, options?.isCancelled)) {
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
    await syncProjectDirToObjectStorage(job.projectId).catch(() => undefined);
  } catch (err) {
    if (await checkCancelled(jobId, options?.isCancelled)) {
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

export type { TtsJob };
