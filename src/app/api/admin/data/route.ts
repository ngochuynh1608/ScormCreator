import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { listUsers } from "@/lib/auth/users";
import { deleteProject, listProjects } from "@/lib/db";
import { projectSizeBytes } from "@/lib/storage";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";

export type OrphanReason = "unassigned" | "missing-user";

export type AdminDataProject = {
  id: string;
  title: string;
  originalFileName: string;
  status: Project["status"];
  createdAt: string;
  updatedAt: string;
  ownerId: string | null;
  sizeBytes: number;
  reason: OrphanReason;
};

function orphanReason(
  project: Project,
  userIds: Set<string>,
): OrphanReason | null {
  const owner = project.ownerId?.trim();
  if (!owner) return "unassigned";
  if (!userIds.has(owner)) return "missing-user";
  return null;
}

async function listOrphanProjects(): Promise<{
  projects: AdminDataProject[];
  totalBytes: number;
}> {
  const [users, all] = await Promise.all([listUsers(), listProjects()]);
  const userIds = new Set(users.map((u) => u.id));
  const orphans: AdminDataProject[] = [];
  let totalBytes = 0;
  for (const project of all) {
    const reason = orphanReason(project, userIds);
    if (!reason) continue;
    const sizeBytes = await projectSizeBytes(project.id);
    totalBytes += sizeBytes;
    orphans.push({
      id: project.id,
      title: project.title,
      originalFileName: project.originalFileName || "",
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      ownerId: project.ownerId?.trim() || null,
      sizeBytes,
      reason,
    });
  }
  orphans.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { projects: orphans, totalBytes };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const data = await listOrphanProjects();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to list unassigned projects", err);
    return NextResponse.json(
      { error: "Không tải được danh sách dữ liệu." },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = deleteSchema.parse(await req.json());
    const [users, all] = await Promise.all([listUsers(), listProjects()]);
    const userIds = new Set(users.map((u) => u.id));
    const byId = new Map(all.map((p) => [p.id, p]));
    let deleted = 0;
    let freedBytes = 0;
    const skipped: string[] = [];
    for (const id of body.ids) {
      const project = byId.get(id);
      if (!project || !orphanReason(project, userIds)) {
        skipped.push(id);
        continue;
      }
      const sizeBytes = await projectSizeBytes(id);
      const ok = await deleteProject(id);
      if (ok) {
        deleted += 1;
        freedBytes += sizeBytes;
      } else {
        skipped.push(id);
      }
    }
    return NextResponse.json({ ok: true, deleted, freedBytes, skipped });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    console.error("Failed to delete unassigned projects", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xóa thất bại." },
      { status: 500 },
    );
  }
}
