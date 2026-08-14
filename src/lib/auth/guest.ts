import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./session";
import { cookieSecureFlag } from "./cookies";
import type { SessionPayload } from "./types";
import { getProject, saveProject } from "../db";
import type { Project } from "../types";

export function guestCookieName(projectId: string) {
  return `scorm_guest_${projectId}`;
}

export function createGuestClaimToken() {
  return randomBytes(24).toString("hex");
}

export function attachGuestClaimCookie(
  res: NextResponse,
  projectId: string,
  token: string,
) {
  res.cookies.set(guestCookieName(projectId), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: cookieSecureFlag(),
  });
  return res;
}

export function clearGuestClaimCookie(res: NextResponse, projectId: string) {
  res.cookies.set(guestCookieName(projectId), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

function readGuestToken(req: NextRequest, projectId: string) {
  return req.cookies.get(guestCookieName(projectId))?.value || null;
}

/**
 * Access if: session owns project, OR unclaimed guest with matching claim cookie.
 */
export async function requireProjectAccess(
  req: NextRequest,
  projectId: string,
): Promise<
  | {
      project: Project;
      session: SessionPayload | null;
      isGuest: boolean;
      error?: undefined;
    }
  | { error: NextResponse; project?: undefined; session?: undefined; isGuest?: undefined }
> {
  const project = await getProject(projectId);
  if (!project) {
    return {
      error: NextResponse.json(
        { error: "Không tìm thấy dự án." },
        { status: 404 },
      ),
    };
  }

  const session = await getSession();

  if (session) {
    if (!project.ownerId || project.ownerId === session.userId) {
      // Legacy unclaimed + signed-in user can open; claim happens via /claim.
      return { project, session, isGuest: !project.ownerId };
    }
    return {
      error: NextResponse.json(
        { error: "Bạn không có quyền với dự án này." },
        { status: 403 },
      ),
    };
  }

  // Guest path: unclaimed + valid cookie
  if (!project.ownerId && project.guestClaimToken) {
    const token = readGuestToken(req, projectId);
    if (token && token === project.guestClaimToken) {
      return { project, session: null, isGuest: true };
    }
  }

  return {
    error: NextResponse.json(
      { error: "Bạn cần đăng nhập để mở dự án này." },
      { status: 401 },
    ),
  };
}

export async function claimGuestProject(
  projectId: string,
  userId: string,
  guestToken: string | null,
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  if (project.ownerId && project.ownerId !== userId) {
    throw new Error("Dự án đã thuộc tài khoản khác.");
  }
  if (
    project.guestClaimToken &&
    guestToken &&
    guestToken !== project.guestClaimToken
  ) {
    throw new Error("Phiên khách không hợp lệ.");
  }
  project.ownerId = userId;
  project.guestClaimToken = null;
  return saveProject(project);
}
