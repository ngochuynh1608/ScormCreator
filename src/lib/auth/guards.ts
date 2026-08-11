import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionPayload } from "./types";
import { getProject } from "../db";
import { findUserById, resolveUserRole, toPublicUser } from "./users";

export async function requireSession(): Promise<
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Bạn cần đăng nhập." },
        { status: 401 },
      ),
    };
  }
  return { session };
}

export async function requireAdmin(): Promise<
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse }
> {
  const auth = await requireSession();
  if (auth.error) return auth;
  const user = await findUserById(auth.session.userId);
  if (!user || resolveUserRole(user) !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Chỉ admin hệ thống mới truy cập được." },
        { status: 403 },
      ),
    };
  }
  return {
    session: {
      ...auth.session,
      role: "admin",
      name: user.name,
      email: user.email,
    },
  };
}

export async function requireProjectOwner(
  projectId: string,
  session: SessionPayload,
) {
  const project = await getProject(projectId);
  if (!project) {
    return {
      error: NextResponse.json(
        { error: "Không tìm thấy dự án." },
        { status: 404 },
      ),
    };
  }
  if (project.ownerId && project.ownerId !== session.userId) {
    return {
      error: NextResponse.json(
        { error: "Bạn không có quyền với dự án này." },
        { status: 403 },
      ),
    };
  }
  // Legacy/local projects without owner: claim on first authenticated access.
  if (!project.ownerId) {
    const { saveProject } = await import("../db");
    project.ownerId = session.userId;
    await saveProject(project);
  }
  return { project };
}

export function appOrigin(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function currentPublicUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  return toPublicUser(user);
}
