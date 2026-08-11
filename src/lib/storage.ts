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

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function publicFileUrl(projectId: string, relativePath: string) {
  return `/api/files/${projectId}/${relativePath.split(path.sep).join("/")}`;
}
