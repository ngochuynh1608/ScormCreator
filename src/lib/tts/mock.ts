import fs from "fs/promises";
import path from "path";
import { estimateDurationMs } from "./estimate";
import { projectAudioDir } from "../storage";

export { estimateDurationMs } from "./estimate";

function writeWavHeader(dataLength: number, sampleRate: number): Buffer {
  const buffer = Buffer.alloc(44);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

/**
 * Mock TTS: generates a soft tone burst train sized to narration length.
 * Swap this module for Azure/Google/ElevenLabs without changing call sites.
 */
export async function synthesizeMockSpeech(options: {
  projectId: string;
  slideId: string;
  text: string;
  rate?: number;
  pitch?: number;
}): Promise<{ relativePath: string; durationMs: number }> {
  const rate = options.rate ?? 1;
  const pitch = options.pitch ?? 1;
  const durationMs = estimateDurationMs(options.text, rate);
  const sampleRate = 22050;
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const pcm = Buffer.alloc(totalSamples * 2);

  const baseFreq = 180 * pitch;
  const words = Math.max(1, options.text.trim().split(/\s+/).length);
  const burstLen = Math.floor(sampleRate * 0.08);
  const gap = Math.floor(totalSamples / words);

  for (let w = 0; w < words; w++) {
    const start = Math.min(totalSamples - 1, w * gap);
    for (let i = 0; i < burstLen; i++) {
      const idx = start + i;
      if (idx >= totalSamples) break;
      const t = i / sampleRate;
      const envelope = Math.sin((Math.PI * i) / burstLen);
      const sample =
        Math.sin(2 * Math.PI * baseFreq * t) * 0.18 * envelope +
        Math.sin(2 * Math.PI * baseFreq * 1.5 * t) * 0.06 * envelope;
      pcm.writeInt16LE(Math.max(-32767, Math.min(32767, sample * 32767)), idx * 2);
    }
  }

  const header = writeWavHeader(pcm.length, sampleRate);
  const fileName = `${options.slideId}-${Date.now()}.wav`;
  const abs = path.join(projectAudioDir(options.projectId), fileName);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.concat([header, pcm]));

  return {
    relativePath: `audio/${fileName}`,
    durationMs,
  };
}
