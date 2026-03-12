import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";

// ── Route classification ───────────────────────────────────────────────────

/**
 * Paths that are fully public — no authentication required.
 * Everything else under /api requires a valid session.
 */
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/magic-link",
  "/api/auth/logout",
  "/api/auth/invite/verify",
  "/api/auth/invite/accept",
];

/**
 * Paths under /api that require the caller to hold the "admin" role.
 * Add new admin namespaces here as they are created.
 */
const ADMIN_API_PREFIXES = ["/api/admin"];

// ── Middleware ─────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept API routes — let Next.js handle page routes freely.
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // ── Public routes — bypass auth entirely ─────────────────────────────────
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Decode session token ─────────────────────────────────────────────────
  const tokenValue = req.cookies.get(SESSION_COOKIE)?.value;

  if (!tokenValue) {
    return unauthorized("Authentication required. Please log in.");
  }

  const session = await decodeSession(tokenValue);

  if (!session) {
    return unauthorized("Session is invalid or has expired. Please log in again.");
  }

  // ── Admin-only routes ────────────────────────────────────────────────────
  if (ADMIN_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (session.role !== "admin") {
      return forbidden("You do not have permission to access this resource.");
    }
  }

  // ── Forward session data to route handlers via headers ───────────────────
  // Route handlers can read these with req.headers.get("x-user-id") etc.
  const headers = new Headers(req.headers);
  headers.set("x-user-id", session.id);
  headers.set("x-user-email", session.email);
  headers.set("x-user-role", session.role);

  return NextResponse.next({ request: { headers } });
}

// ── Response helpers ───────────────────────────────────────────────────────

function unauthorized(message: string) {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ success: false, message }, { status: 403 });
}

// ── Matcher ────────────────────────────────────────────────────────────────

export const config = {
  /**
   * Run the middleware on every /api route.
   * Exclude Next.js internals and static assets.
   */
  matcher: ["/api/:path*"],
};
