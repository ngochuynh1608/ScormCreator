import { v4 as uuidv4 } from "uuid";
import { getDocumentStore } from "../store";
import { packageScormZip } from "../scorm/package";
import { getProject } from "../db";
import { syncProjectDirToObjectStorage } from "../object-storage";
import type { ExportJobPayload, ExportJobRecord } from "./types";
import path from "path";

const EXPORT_COLLECTION = "exportJobs";

export async function createExportJobRecord(input: {
  projectId: string;
  version: "1.2" | "2004";
  ownerId?: string;
}): Promise<ExportJobRecord> {
  const now = new Date().toISOString();
  const record: ExportJobRecord = {
    id: uuidv4(),
    projectId: input.projectId,
    version: input.version,
    status: "queued",
    ownerId: input.ownerId,
    createdAt: now,
    updatedAt: now,
  };
  const store = await getDocumentStore();
  await store.put(EXPORT_COLLECTION, record);
  return record;
}

export async function getExportJob(
  id: string,
): Promise<ExportJobRecord | null> {
  const store = await getDocumentStore();
  return store.get<ExportJobRecord>(EXPORT_COLLECTION, id);
}

export async function upsertExportJob(job: ExportJobRecord) {
  const store = await getDocumentStore();
  job.updatedAt = new Date().toISOString();
  await store.put(EXPORT_COLLECTION, job);
  return job;
}

export async function processExportJob(payload: ExportJobPayload) {
  const job = await getExportJob(payload.exportId);
  if (!job) throw new Error(`Export job ${payload.exportId} not found`);

  job.status = "running";
  await upsertExportJob(job);

  try {
    const project = await getProject(payload.projectId);
    if (!project) throw new Error("Không tìm thấy dự án.");
    const zipPath = await packageScormZip(project, payload.version);
    const fileName = path.basename(zipPath);
    job.status = "done";
    job.relativePath = `exports/${fileName}`;
    job.fileName = fileName;
    await upsertExportJob(job);
    await syncProjectDirToObjectStorage(payload.projectId).catch(
      () => undefined,
    );
    console.info(
      `[export] done project=${payload.projectId} file=${fileName}`,
    );
  } catch (err) {
    job.status = "error";
    job.errorMessage =
      err instanceof Error ? err.message : "Xuất SCORM thất bại";
    await upsertExportJob(job);
    throw err;
  }
}
