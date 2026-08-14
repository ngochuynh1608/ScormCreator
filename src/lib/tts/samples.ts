import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { dataRoot } from "../storage";
import {
  createEveraiTts,
  waitForEveraiAudio,
} from "./everai";
import { findEveraiVoice } from "./voices";

export function ttsSamplesDir() {
  return path.join(dataRoot(), "tts-samples");
}

export function ttsSamplePath(voiceCode: string) {
  const safe = voiceCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(ttsSamplesDir(), `${safe}.mp3`);
}

export async function listExistingSampleCodes(
  voiceCodes: string[],
): Promise<string[]> {
  const out: string[] = [];
  for (const code of voiceCodes) {
    if (existsSync(ttsSamplePath(code))) out.push(code);
  }
  return out;
}

export async function hasVoiceSample(voiceCode: string): Promise<boolean> {
  try {
    await fs.access(ttsSamplePath(voiceCode));
    return true;
  } catch {
    return false;
  }
}

export async function readVoiceSample(
  voiceCode: string,
): Promise<Buffer | null> {
  try {
    return await fs.readFile(ttsSamplePath(voiceCode));
  } catch {
    return null;
  }
}

/** Generate (or regenerate) a cached sample for a voice via EverAI. */
export async function generateVoiceSample(options: {
  apiKey: string;
  voiceCode: string;
  text: string;
  modelId?: string;
}): Promise<{ voiceCode: string; bytes: number }> {
  const voice = findEveraiVoice(options.voiceCode);
  if (!voice) throw new Error("Không tìm thấy mã giọng đọc.");
  const text = options.text.trim();
  if (!text) throw new Error("Nhập đoạn text mẫu trước khi tạo giọng.");
  if (text.length > 500) throw new Error("Text mẫu tối đa 500 ký tự.");

  const created = await createEveraiTts({
    apiKey: options.apiKey,
    text,
    voiceCode: options.voiceCode,
    modelId: options.modelId,
  });
  const audioLink = await waitForEveraiAudio({
    apiKey: options.apiKey,
    requestId: created.requestId,
    timeoutMs: 120_000,
  });

  const res = await fetch(audioLink);
  if (!res.ok) {
    throw new Error(`Không tải được audio mẫu (HTTP ${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(ttsSamplesDir(), { recursive: true });
  await fs.writeFile(ttsSamplePath(options.voiceCode), buf);
  return { voiceCode: options.voiceCode, bytes: buf.length };
}
