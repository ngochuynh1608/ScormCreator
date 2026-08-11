import fs from "fs/promises";
import path from "path";
import { projectAudioDir } from "../storage";
import { estimateDurationMs } from "./estimate";

const API_BASE =
  process.env.EVERAI_API_BASE?.replace(/\/$/, "") ||
  "https://www.everai.vn/api/v1";

export type EveraiCreateResult = {
  requestId: string;
  characters: number;
  status: string;
};

export type EveraiPollResult = {
  requestId: string;
  status: string;
  progress?: number;
  audioLink?: string;
  errorMessage?: string;
};

type EveraiApiResponse<T> = {
  status: number;
  error_code?: string | number;
  error_message?: string;
  result?: T;
};

function formatEveraiError(
  payload: EveraiApiResponse<unknown> | null,
  httpStatus: number,
): string {
  const code = payload?.error_code;
  const raw = (payload?.error_message || "").trim();
  const codeNum = typeof code === "number" ? code : Number(code);

  if (codeNum === 402 || /credit/i.test(raw)) {
    return (
      "Số dư credit EverAI không đủ. Nạp thêm tại everai.vn hoặc chọn giọng rẻ hơn, rồi thử lại."
    );
  }
  if (codeNum === 406 || /doesn't support voice/i.test(raw)) {
    return (
      raw ||
      "Model không hỗ trợ giọng đã chọn. Đổi model hoặc giọng trong Admin / panel narration."
    );
  }
  if (codeNum === 401 || httpStatus === 401) {
    return "API key EverAI không hợp lệ. Kiểm tra lại tại /admin.";
  }

  return raw || (code != null ? `EverAI lỗi ${code}` : `EverAI lỗi HTTP ${httpStatus}`);
}

async function everaiFetch<T>(
  apiKey: string,
  urlPath: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      ...(init?.headers || {}),
    },
  });

  let payload: EveraiApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as EveraiApiResponse<T>;
  } catch {
    throw new Error(`EverAI trả về phản hồi không hợp lệ (HTTP ${res.status}).`);
  }

  if (!res.ok || payload.status !== 1 || !payload.result) {
    throw new Error(formatEveraiError(payload, res.status));
  }
  return payload.result;
}

/** Cheap/default voices are not tied to everai-v1.x model_id. */
function voiceSupportsModelId(voiceCode: string): boolean {
  return !/_default$/i.test(voiceCode);
}

export async function createEveraiTts(options: {
  apiKey: string;
  text: string;
  voiceCode: string;
  modelId?: string;
  speedRate?: number;
  pitchRate?: number;
  volume?: number;
}): Promise<EveraiCreateResult> {
  const speed = clamp(options.speedRate ?? 1, 0.5, 2);
  const pitch = clamp(options.pitchRate ?? 1, 0.5, 2);
  const volume = Math.round(clamp(options.volume ?? 100, 50, 150));

  const body: Record<string, unknown> = {
    response_type: "indirect",
    input_text: options.text,
    voice_code: options.voiceCode,
    audio_type: "mp3",
    bitrate: 128,
    speed_rate: Number(speed.toFixed(1)),
    pitch_rate: Number(pitch.toFixed(1)),
    volume,
    generate_srt: false,
  };

  if (voiceSupportsModelId(options.voiceCode)) {
    body.model_id = options.modelId || "everai-v1.6";
  }

  const result = await everaiFetch<{
    request_id: string;
    characters: number;
    status: string;
  }>(options.apiKey, "/tts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    requestId: result.request_id,
    characters: result.characters,
    status: result.status,
  };
}

export async function getEveraiTtsRequest(
  apiKey: string,
  requestId: string,
): Promise<EveraiPollResult> {
  const result = await everaiFetch<{
    request_id: string;
    status: string;
    progress?: number;
    audio_link?: string;
    error_message?: string;
  }>(apiKey, `/tts/${encodeURIComponent(requestId)}`, { method: "GET" });

  return {
    requestId: result.request_id,
    status: result.status,
    progress: result.progress,
    audioLink: result.audio_link,
    errorMessage: result.error_message,
  };
}

export async function waitForEveraiAudio(options: {
  apiKey: string;
  requestId: string;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const info = await getEveraiTtsRequest(options.apiKey, options.requestId);
    const status = (info.status || "").toLowerCase();

    if (
      (status === "done" || status === "success") &&
      info.audioLink
    ) {
      return info.audioLink;
    }
    if (
      status === "failure" ||
      status === "failed" ||
      status === "error"
    ) {
      throw new Error(info.errorMessage || "EverAI TTS thất bại.");
    }
    await sleep(intervalMs);
  }

  throw new Error("EverAI TTS quá thời gian chờ. Thử lại sau.");
}

export async function downloadEveraiAudio(options: {
  projectId: string;
  slideId: string;
  audioUrl: string;
  textForDuration?: string;
  rate?: number;
}): Promise<{ relativePath: string; durationMs: number }> {
  const res = await fetch(options.audioUrl);
  if (!res.ok) {
    throw new Error(`Không tải được audio EverAI (HTTP ${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // Unique name so browsers/LMS don't keep serving a cached previous MP3.
  const fileName = `${options.slideId}-${Date.now()}.mp3`;
  const abs = path.join(projectAudioDir(options.projectId), fileName);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);

  return {
    relativePath: `audio/${fileName}`,
    durationMs: estimateDurationMs(
      options.textForDuration || "",
      options.rate ?? 1,
    ),
  };
}

/** Full EverAI synthesize pipeline: create → poll → download. */
export async function synthesizeEveraiSpeech(options: {
  apiKey: string;
  projectId: string;
  slideId: string;
  text: string;
  voiceCode: string;
  modelId?: string;
  speedRate?: number;
  pitchRate?: number;
}): Promise<{
  relativePath: string;
  durationMs: number;
  requestId: string;
  characters: number;
}> {
  const created = await createEveraiTts({
    apiKey: options.apiKey,
    text: options.text,
    voiceCode: options.voiceCode,
    modelId: options.modelId,
    speedRate: options.speedRate,
    pitchRate: options.pitchRate,
  });

  const audioLink = await waitForEveraiAudio({
    apiKey: options.apiKey,
    requestId: created.requestId,
  });

  const saved = await downloadEveraiAudio({
    projectId: options.projectId,
    slideId: options.slideId,
    audioUrl: audioLink,
    textForDuration: options.text,
    rate: options.speedRate,
  });

  return {
    ...saved,
    requestId: created.requestId,
    characters: created.characters || options.text.length,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
