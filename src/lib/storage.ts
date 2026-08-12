import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const ROOT = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.DATA_DIR || "data",
);

function ensureDirSync(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDirSync(ROOT);
ensureDirSync(path.join(ROOT, "projects"));
ensureDirSync(path.join(ROOT, "jobs"));

export function dataRoot() {
  return ROOT;
}

export function projectDir(projectId: string) {
  return path.join(ROOT, "projects", projectId);
}

export function projectMediaDir(projectId: string) {
  return path.join(projectDir(projectId), "media");
}

export function projectAudioDir(projectId: string) {
  return path.join(projectDir(projectId), "audio");
}

export function projectThumbDir(projectId: string) {
  return path.join(projectDir(projectId), "thumbs");
}

export function projectMetaPath(projectId: string) {
  return path.join(projectDir(projectId), "meta.json");
}

export function jobsIndexPath() {
  return path.join(ROOT, "jobs", "index.json");
}

export async function ensureProjectDirs(projectId: string) {
  const dirs = [
    projectDir(projectId),
    projectMediaDir(projectId),
    projectAudioDir(projectId),
    projectThumbDir(projectId),
  ];
  await Promise.all(dirs.map((d) => fs.mkdir(d, { recursive: true })));
}

/** Serialize writes per absolute path (prevents interleaved JSON corruption). */
const writeLocks = new Map<string, Promise<void>>();

async function withWriteLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const key = path.resolve(filePath);
  const prev = writeLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  writeLocks.set(
    key,
    prev.then(() => gate).catch(() => gate),
  );
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (writeLocks.get(key) === gate) writeLocks.delete(key);
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Atomic JSON write: temp file + rename.
 * Avoids truncated / interleaved meta.json that made projects "disappear".
 */
export async function writeJson(filePath: string, data: unknown) {
  await withWriteLock(filePath, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(tmp, payload, "utf8");
      try {
        await fs.rename(tmp, filePath);
      } catch {
        // Windows cannot rename over an existing file.
        await fs.copyFile(tmp, filePath);
        await fs.unlink(tmp).catch(() => undefined);
      }
    } catch (err) {
      await fs.unlink(tmp).catch(() => undefined);
      throw err;
    }
  });
}

export function publicFileUrl(projectId: string, relativePath: string) {
  return `/api/files/${projectId}/${relativePath.split(path.sep).join("/")}`;
}
