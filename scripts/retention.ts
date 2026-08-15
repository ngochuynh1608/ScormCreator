/**
 * Retention / cleanup for high-storage deployments.
 * Deletes old export ZIPs and optionally stale guest projects.
 *
 *   npx tsx scripts/retention.ts
 *
 * Env:
 *   EXPORT_RETENTION_DAYS=14
 *   GUEST_PROJECT_RETENTION_DAYS=7  (0 = skip)
 */
import fs from "fs/promises";
import path from "path";
import { dataRoot, projectDir, projectMetaPath, readJson } from "../src/lib/storage";
import type { Project } from "../src/lib/types";

const exportDays = Math.max(0, Number(process.env.EXPORT_RETENTION_DAYS || 14));
const guestDays = Math.max(
  0,
  Number(process.env.GUEST_PROJECT_RETENTION_DAYS || 7),
);

function olderThan(iso: string, days: number) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}

async function cleanExports(projectId: string) {
  if (exportDays <= 0) return 0;
  const exportDir = path.join(projectDir(projectId), "exports");
  let removed = 0;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(exportDir);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - exportDays * 24 * 60 * 60 * 1000;
  for (const name of entries) {
    if (!name.toLowerCase().endsWith(".zip")) continue;
    const abs = path.join(exportDir, name);
    try {
      const st = await fs.stat(abs);
      if (st.mtimeMs < cutoff) {
        await fs.unlink(abs);
        removed += 1;
      }
    } catch {
      // ignore
    }
  }
  return removed;
}

async function main() {
  const root = path.join(dataRoot(), "projects");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    console.info("[retention] no projects dir");
    return;
  }

  let exportRemoved = 0;
  let guestRemoved = 0;

  for (const id of entries) {
    const abs = path.join(root, id);
    const st = await fs.stat(abs).catch(() => null);
    if (!st?.isDirectory()) continue;

    exportRemoved += await cleanExports(id);

    if (guestDays > 0) {
      const meta = await readJson<Project>(projectMetaPath(id));
      if (
        meta &&
        !meta.ownerId &&
        olderThan(meta.updatedAt || meta.createdAt, guestDays)
      ) {
        await fs.rm(abs, { recursive: true, force: true });
        guestRemoved += 1;
        console.info(`[retention] removed guest project ${id}`);
      }
    }
  }

  console.info(
    `[retention] done exportZips=${exportRemoved} guestProjects=${guestRemoved}`,
  );

  try {
    const { cleanupExpiredEmailOtps } = await import(
      "../src/lib/auth/email-otp"
    );
    await cleanupExpiredEmailOtps();
    console.info("[retention] cleaned expired email verification codes");
  } catch (err) {
    console.error(
      "[retention] email otp cleanup failed",
      err instanceof Error ? err.message : err,
    );
  }
}

main().catch((err) => {
  console.error("[retention] fatal", err);
  process.exit(1);
});
