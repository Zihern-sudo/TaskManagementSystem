import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/magic-link",
  "/api/auth/logout",
  "/api/auth/invite/verify",
  "/api/auth/invite/accept",
];

const ADMIN_API_PREFIXES = ["/api/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── API routes ────────────────────────────────────────────────────────────
  if (pathname.startsWith("/api")) {
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    const tokenValue = req.cookies.get(SESSION_COOKIE)?.value;
    if (!tokenValue) {
      return NextResponse.json({ success: false, message: "Authentication required. Please log in." }, { status: 401 });
    }

    const session = await decodeSession(tokenValue);
    if (!session) {
      return NextResponse.json({ success: false, message: "Session is invalid or has expired. Please log in again." }, { status: 401 });
    }

    if (ADMIN_API_PREFIXES.some((p) => pathname.startsWith(p)) && session.role !== "admin") {
      return NextResponse.json({ success: false, message: "You do not have permission to access this resource." }, { status: 403 });
    }

    const headers = new Headers(req.headers);
    headers.set("x-user-id", session.id);
    headers.set("x-user-email", session.email);
    headers.set("x-user-role", session.role);
    return NextResponse.next({ request: { headers } });
  }

  // ── Login page — redirect to /tasks if already authenticated ─────────────
  if (pathname === "/login") {
    const tokenValue = req.cookies.get(SESSION_COOKIE)?.value;
    if (tokenValue) {
      const session = await decodeSession(tokenValue);
      if (session) return NextResponse.redirect(new URL("/tasks", req.url));
    }
    return NextResponse.next();
  }

  // ── Root — redirect based on auth ─────────────────────────────────────────
  if (pathname === "/") {
    const tokenValue = req.cookies.get(SESSION_COOKIE)?.value;
    const session = tokenValue ? await decodeSession(tokenValue) : null;
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.redirect(new URL("/tasks", req.url));
  }

  // ── Protected page routes ─────────────────────────────────────────────────
  const tokenValue = req.cookies.get(SESSION_COOKIE)?.value;
  if (!tokenValue) return NextResponse.redirect(new URL("/login", req.url));

  const session = await decodeSession(tokenValue);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/tasks", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.ico).*)"],
};
