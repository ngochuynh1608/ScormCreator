import fs from "fs/promises";
import path from "path";
import {
  dataRoot,
  projectDir,
  projectMetaPath,
  readJson,
  writeJson,
} from "./storage";
import { COLLECTIONS, getDocumentStore } from "./store";
import type { Project, Slide, TtsJob } from "./types";
import { deleteProjectObjects } from "./object-storage";

/** Folder name is the source of truth for project id (fixes copied folders). */
function withFolderId(folderId: string, meta: Project): Project {
  if (meta.id === folderId) return meta;
  return { ...meta, id: folderId };
}

async function healMetaId(folderId: string, meta: Project): Promise<Project> {
  if (meta.id === folderId) return meta;
  const fixed = withFolderId(folderId, meta);
  // Keep timestamps; only correct identity mismatch from manual folder copies.
  await writeJson(projectMetaPath(folderId), fixed);
  return fixed;
}

export async function listProjects(ownerId?: string): Promise<Project[]> {
  const root = path.join(dataRoot(), "projects");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const projects: Project[] = [];
  for (const folderId of entries) {
    const abs = path.join(root, folderId);
    try {
      const st = await fs.stat(abs);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    const meta = await readJson<Project>(projectMetaPath(folderId));
    if (!meta) continue;
    const project = await healMetaId(folderId, meta);
    if (ownerId && project.ownerId !== ownerId) continue;
    projects.push(project);
  }
  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const meta = await readJson<Project>(projectMetaPath(id));
  if (!meta) return null;
  return healMetaId(id, meta);
}

export async function saveProject(project: Project): Promise<Project> {
  project.updatedAt = new Date().toISOString();
  await writeJson(projectMetaPath(project.id), project);
  return project;
}

export async function updateSlides(
  projectId: string,
  slides: Slide[],
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  project.slides = slides;
  return saveProject(project);
}

export async function deleteProject(id: string): Promise<boolean> {
  await deleteProjectObjects(id).catch(() => undefined);
  const dir = projectDir(id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore — treat missing dir as already deleted
  }
  try {
    await fs.access(dir);
    return false;
  } catch {
    return true;
  }
}

export async function listJobs(): Promise<TtsJob[]> {
  const store = await getDocumentStore();
  return store.list<TtsJob>(COLLECTIONS.jobs);
}

export async function getJob(id: string): Promise<TtsJob | null> {
  const store = await getDocumentStore();
  return store.get<TtsJob>(COLLECTIONS.jobs, id);
}

export async function upsertJob(job: TtsJob): Promise<TtsJob> {
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.jobs, job);
  return job;
}

/** Replace the full jobs collection (admin / cleanup tools). */
export async function saveJobs(jobs: TtsJob[]) {
  const store = await getDocumentStore();
  await store.replaceAll(COLLECTIONS.jobs, jobs);
}
