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

export async function listProjects(ownerId?: string): Promise<Project[]> {
  const root = path.join(dataRoot(), "projects");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const projects: Project[] = [];
  for (const id of entries) {
    const meta = await readJson<Project>(projectMetaPath(id));
    if (!meta) continue;
    if (ownerId && meta.ownerId !== ownerId) continue;
    projects.push(meta);
  }
  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  return readJson<Project>(projectMetaPath(id));
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
  const dir = projectDir(id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore — treat missing dir as already deleted
  }
  // Also drop any leftover if parent "projects" was recreated empty
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
