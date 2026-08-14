import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection, isRedisConfigured } from "./connection";
import {
  QUEUE_CONVERT,
  QUEUE_EXPORT,
  QUEUE_TTS,
  type ConvertJobPayload,
  type ExportJobPayload,
  type TtsJobPayload,
} from "./types";

let convertQueue: Queue<ConvertJobPayload> | null = null;
let ttsQueue: Queue<TtsJobPayload> | null = null;
let exportQueue: Queue<ExportJobPayload> | null = null;

const defaultJobOpts: JobsOptions = {
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 200 },
  attempts: 2,
  backoff: { type: "exponential", delay: 5_000 },
};

function getConvertQueue() {
  if (!convertQueue) {
    convertQueue = new Queue<ConvertJobPayload>(QUEUE_CONVERT, {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobOpts,
    });
  }
  return convertQueue;
}

function getTtsQueue() {
  if (!ttsQueue) {
    ttsQueue = new Queue<TtsJobPayload>(QUEUE_TTS, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOpts,
        attempts: 1,
      },
    });
  }
  return ttsQueue;
}

function getExportQueue() {
  if (!exportQueue) {
    exportQueue = new Queue<ExportJobPayload>(QUEUE_EXPORT, {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobOpts,
    });
  }
  return exportQueue;
}

export function convertQueueMax(): number {
  return Math.max(1, Number(process.env.CONVERT_QUEUE_MAX || 50));
}

export async function getConvertQueueDepth(): Promise<number> {
  if (!isRedisConfigured()) return 0;
  const q = getConvertQueue();
  const counts = await q.getJobCounts("waiting", "active", "delayed");
  return counts.waiting + counts.active + counts.delayed;
}

export async function enqueueConvertJob(
  payload: ConvertJobPayload,
): Promise<{ id: string; queued: boolean }> {
  if (!isRedisConfigured()) {
    const { processConvertJob } = await import("./convert-processor");
    const id = `inline-convert-${payload.projectId}-${Date.now()}`;
    void processConvertJob(payload).catch((err) => {
      console.error("[convert-inline]", payload.projectId, err);
    });
    return { id, queued: true };
  }

  const depth = await getConvertQueueDepth();
  if (depth >= convertQueueMax()) {
    const err = new Error(
      `Hệ thống đang xử lý nhiều file (hàng đợi ${depth}). Thử lại sau vài phút.`,
    );
    (err as Error & { status?: number }).status = 429;
    throw err;
  }

  const job = await getConvertQueue().add("convert", payload, {
    jobId:
      payload.mode === "ingest"
        ? `convert-${payload.projectId}`
        : `rerender-${payload.projectId}-${Date.now()}`,
  });
  return { id: String(job.id), queued: true };
}

export async function enqueueTtsBullJob(
  payload: TtsJobPayload,
): Promise<{ id: string }> {
  if (!isRedisConfigured()) {
    return { id: payload.jobId };
  }
  const job = await getTtsQueue().add("tts", payload, {
    jobId: `tts-${payload.jobId}`,
  });
  return { id: String(job.id) };
}

export async function enqueueExportJob(
  payload: ExportJobPayload,
): Promise<{ id: string }> {
  if (!isRedisConfigured()) {
    const { processExportJob } = await import("./export-processor");
    void processExportJob(payload).catch((err) => {
      console.error("[export-inline]", payload.exportId, err);
    });
    return { id: payload.exportId };
  }
  const job = await getExportQueue().add("export", payload, {
    jobId: `export-${payload.exportId}`,
  });
  return { id: String(job.id) };
}

export async function getQueueMetrics() {
  if (!isRedisConfigured()) {
    return {
      redis: false,
      convert: { waiting: 0, active: 0, delayed: 0, failed: 0 },
      tts: { waiting: 0, active: 0, delayed: 0, failed: 0 },
      export: { waiting: 0, active: 0, delayed: 0, failed: 0 },
    };
  }
  const [c, t, e] = await Promise.all([
    getConvertQueue().getJobCounts("waiting", "active", "delayed", "failed"),
    getTtsQueue().getJobCounts("waiting", "active", "delayed", "failed"),
    getExportQueue().getJobCounts("waiting", "active", "delayed", "failed"),
  ]);
  return {
    redis: true,
    convert: c,
    tts: t,
    export: e,
  };
}

export async function closeQueues() {
  await Promise.all([
    convertQueue?.close(),
    ttsQueue?.close(),
    exportQueue?.close(),
  ]);
  convertQueue = null;
  ttsQueue = null;
  exportQueue = null;
}
