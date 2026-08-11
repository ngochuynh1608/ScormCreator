import { requireProjectOwner, requireSession } from "./guards";
import type { Project } from "../types";
import type { NextResponse } from "next/server";
import type { SessionPayload } from "./types";

export async function requireOwnedProject(projectId: string): Promise<
  | { session: SessionPayload; project: Project; error?: undefined }
  | { session?: undefined; project?: undefined; error: NextResponse }
> {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };
  const owned = await requireProjectOwner(projectId, auth.session);
  if (owned.error) return { error: owned.error };
  return { session: auth.session, project: owned.project };
}
