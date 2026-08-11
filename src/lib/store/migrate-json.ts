import fs from "fs/promises";
import path from "path";
import { dataRoot, readJson } from "../storage";
import { COLLECTIONS, type DocumentStore } from "./types";
import type { AuthUser, SubscriptionPlan } from "../auth/types";
import type { TtsJob } from "../types";

const IMPORT_FLAG = "json_imported_v1";

type LegacyUsage = {
  userId: string;
  creditsUsed: number;
  studentsUsed: number;
  updatedAt: string;
};

type LegacySettings = {
  everaiApiKey?: string;
  defaultVoiceCode?: string;
  defaultModelId?: string;
};

async function archiveJson(filePath: string) {
  try {
    await fs.access(filePath);
    await fs.rename(filePath, `${filePath}.bak`);
  } catch {
    // missing or already archived
  }
}

/**
 * One-time import from legacy JSON files into SQLite.
 * Safe to call on every boot — runs only when the flag is missing.
 */
export async function migrateJsonIntoStore(store: DocumentStore) {
  const done = await store.getMeta(IMPORT_FLAG);
  if (done === "1") return;

  const root = dataRoot();
  const archived: string[] = [];

  const usersPath = path.join(root, "users.json");
  const users = (await readJson<AuthUser[]>(usersPath)) || [];
  if (users.length > 0) {
    await store.putMany(
      COLLECTIONS.users,
      users.map((u) => ({ ...u, id: u.id })),
    );
    archived.push(usersPath);
  }

  const plansPath = path.join(root, "plans.json");
  const plans =
    (await readJson<SubscriptionPlan[]>(plansPath)) || [];
  if (plans.length > 0) {
    await store.putMany(COLLECTIONS.plans, plans);
    archived.push(plansPath);
  }

  const usagePath = path.join(root, "usage.json");
  const usage = (await readJson<LegacyUsage[]>(usagePath)) || [];
  if (usage.length > 0) {
    await store.putMany(
      COLLECTIONS.usage,
      usage.map((u) => ({
        ...u,
        id: u.userId,
      })),
    );
    archived.push(usagePath);
  }

  const settingsPath = path.join(root, "settings.json");
  const settings = await readJson<LegacySettings>(settingsPath);
  if (settings) {
    await store.put(COLLECTIONS.settings, {
      id: "default",
      ...settings,
    });
    archived.push(settingsPath);
  }

  const jobsPath = path.join(root, "jobs", "index.json");
  const jobs = (await readJson<TtsJob[]>(jobsPath)) || [];
  if (jobs.length > 0) {
    await store.putMany(COLLECTIONS.jobs, jobs);
    archived.push(jobsPath);
  }

  await store.setMeta(IMPORT_FLAG, "1");

  for (const file of archived) {
    await archiveJson(file);
  }
}
