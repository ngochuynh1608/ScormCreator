import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getQueueMetrics, convertQueueMax } from "@/lib/jobs/queues";
import { isRedisConfigured } from "@/lib/jobs/connection";
import { isObjectStorageConfigured } from "@/lib/object-storage";
import { postgresConfigured } from "@/lib/store";
import fs from "fs/promises";
import { dataRoot } from "@/lib/storage";

export const runtime = "nodejs";

/** Admin ops metrics: queue depth, storage backend, disk usage of DATA_DIR. */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const queues = await getQueueMetrics();
  let dataDirBytes: number | null = null;
  try {
    dataDirBytes = await dirSize(dataRoot());
  } catch {
    dataDirBytes = null;
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    redis: isRedisConfigured(),
    postgres: postgresConfigured(),
    objectStorage: isObjectStorageConfigured(),
    convertQueueMax: convertQueueMax(),
    convertConcurrency: Number(process.env.CONVERT_CONCURRENCY || 2),
    ttsConcurrency: Number(process.env.TTS_CONCURRENCY || 4),
    queues,
    dataDirBytes,
  });
}

async function dirSize(root: string): Promise<number> {
  let total = 0;
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) {
        const st = await fs.stat(abs);
        total += st.size;
      }
    }
  }
  await walk(root);
  return total;
}
