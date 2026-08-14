/**
 * Background worker: convert (LibreOffice), TTS, SCORM export.
 * Run: npm run worker
 * Requires REDIS_URL (and shared DATA_DIR with the web app).
 */
import { Worker } from "bullmq";
import { getRedisConnection, closeRedisConnection } from "../src/lib/jobs/connection";
import { closeQueues } from "../src/lib/jobs/queues";
import { processConvertJob } from "../src/lib/jobs/convert-processor";
import { processTtsJobById } from "../src/lib/jobs/tts-processor";
import { processExportJob } from "../src/lib/jobs/export-processor";
import {
  QUEUE_CONVERT,
  QUEUE_EXPORT,
  QUEUE_TTS,
  type ConvertJobPayload,
  type ExportJobPayload,
  type TtsJobPayload,
} from "../src/lib/jobs/types";

const convertConcurrency = Math.max(
  1,
  Number(process.env.CONVERT_CONCURRENCY || 2),
);
const ttsConcurrency = Math.max(1, Number(process.env.TTS_CONCURRENCY || 4));
const exportConcurrency = Math.max(
  1,
  Number(process.env.EXPORT_CONCURRENCY || 1),
);

async function main() {
  if (!process.env.REDIS_URL?.trim()) {
    console.error("REDIS_URL is required for the worker process.");
    process.exit(1);
  }

  const connection = getRedisConnection();
  console.info(
    `[worker] starting convert=${convertConcurrency} tts=${ttsConcurrency} export=${exportConcurrency}`,
  );

  const convertWorker = new Worker<ConvertJobPayload>(
    QUEUE_CONVERT,
    async (job) => {
      console.info(
        `[worker:convert] job=${job.id} project=${job.data.projectId}`,
      );
      await processConvertJob(job.data);
    },
    { connection, concurrency: convertConcurrency },
  );

  const ttsWorker = new Worker<TtsJobPayload>(
    QUEUE_TTS,
    async (job) => {
      console.info(`[worker:tts] job=${job.id} ttsJob=${job.data.jobId}`);
      await processTtsJobById(job.data.jobId);
    },
    { connection, concurrency: ttsConcurrency },
  );

  const exportWorker = new Worker<ExportJobPayload>(
    QUEUE_EXPORT,
    async (job) => {
      console.info(
        `[worker:export] job=${job.id} export=${job.data.exportId}`,
      );
      await processExportJob(job.data);
    },
    { connection, concurrency: exportConcurrency },
  );

  for (const w of [convertWorker, ttsWorker, exportWorker]) {
    w.on("failed", (job, err) => {
      console.error(`[worker] failed ${job?.name} ${job?.id}`, err.message);
    });
    w.on("completed", (job) => {
      console.info(`[worker] completed ${job.name} ${job.id}`);
    });
  }

  const shutdown = async (signal: string) => {
    console.info(`[worker] ${signal} — shutting down`);
    await Promise.all([
      convertWorker.close(),
      ttsWorker.close(),
      exportWorker.close(),
    ]);
    await closeQueues();
    await closeRedisConnection();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
