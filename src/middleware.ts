import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "scorm_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/admin",
  "/account",
  "/api/upload",
  "/api/projects",
  "/api/jobs",
  "/api/settings",
  "/api/admin",
  "/api/account",
];

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return true;
  }
  if (pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return true;
  }
  // Public preview + media for shared links
  if (/^\/projects\/[^/]+\/preview\/?$/.test(pathname)) return true;
  if (pathname.startsWith("/api/files/")) return true;
  return false;
}

/** Guest upload → open editor before login. */
function isGuestAccessible(pathname: string) {
  if (pathname === "/api/upload") return true;
  // Editor page for a project
  if (/^\/projects\/[^/]+\/?$/.test(pathname)) return true;
  // Load / save draft (access checked in route via guest cookie)
  if (/^\/api\/projects\/[^/]+\/?$/.test(pathname)) return true;
  // Public shared preview payload (read-only)
  if (/^\/api\/projects\/[^/]+\/public\/?$/.test(pathname)) return true;
  // Claim after login
  if (/^\/api\/projects\/[^/]+\/claim\/?$/.test(pathname)) return true;
  return false;
}

function needsAuth(pathname: string) {
  if (isPublicPath(pathname)) return false;
  if (isGuestAccessible(pathname)) return false;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function secretKey() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "scormcreator-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!needsAuth(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, secretKey());
      ok = true;
    } catch {
      ok = false;
    }
  }

  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/api/upload",
    "/api/projects/:path*",
    "/api/jobs",
    "/api/jobs/:path*",
    "/api/settings/:path*",
    "/api/admin/:path*",
    "/api/account/:path*",
  ],
};
