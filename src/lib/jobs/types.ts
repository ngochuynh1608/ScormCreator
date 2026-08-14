export type ConvertJobPayload = {
  projectId: string;
  kind: "pptx" | "pdf";
  /** Full ingest (parse + render) vs thumbs-only refresh. */
  mode: "ingest" | "rerender";
};

export type TtsJobPayload = {
  jobId: string;
};

export type ExportJobPayload = {
  exportId: string;
  projectId: string;
  version: "1.2" | "2004";
  ownerId?: string;
};

export type ExportJobRecord = {
  id: string;
  projectId: string;
  version: "1.2" | "2004";
  status: "queued" | "running" | "done" | "error";
  ownerId?: string;
  relativePath?: string;
  fileName?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export const QUEUE_CONVERT = "convert";
export const QUEUE_TTS = "tts";
export const QUEUE_EXPORT = "export";
