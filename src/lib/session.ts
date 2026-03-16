import { encode, decode } from "@auth/core/jwt";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * NextAuth v5 uses the cookie name as the JWE salt.
 * Using the same name keeps `auth()` compatible with our manually-issued tokens.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

/** 30-day session lifetime (seconds) */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

// ── Payload type ───────────────────────────────────────────────────────────

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Standard JWT subject claim — set to user.id for NextAuth compatibility */
  sub: string;
}

// ── Token helpers ──────────────────────────────────────────────────────────

/** Encode a user object into a NextAuth-compatible JWE session token. */
export async function encodeSession(payload: SessionPayload): Promise<string> {
  return encode<SessionPayload>({
    token: payload,
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE,
  });
}

/** Decode a session token — returns null if invalid or expired. */
export async function decodeSession(
  token: string
): Promise<SessionPayload | null> {
  try {
    return await decode<SessionPayload>({
      token,
      secret: process.env.NEXTAUTH_SECRET!,
      salt: SESSION_COOKIE,
    });
  } catch {
    return null;
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

/** Write the session cookie onto the current response. */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await encodeSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clear the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// ── Request user (for route handlers) ─────────────────────────────────────

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Read the authenticated user from the request headers injected by middleware.
 *
 * Returns null if the headers are absent (should not happen for protected
 * routes, but useful for optional-auth scenarios).
 */
export function getRequestUser(req: { headers: Headers }): RequestUser | null {
  const id = req.headers.get("x-user-id");
  const email = req.headers.get("x-user-email");
  const role = req.headers.get("x-user-role") as Role | null;
  const name = req.headers.get("x-user-name") ?? "";

  if (!id || !email || !role) return null;
  return { id, email, name, role };
}

// ── Safe user payload builder ──────────────────────────────────────────────

export function toSessionPayload(user: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}): SessionPayload {
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    sub: user.id,
  };
}
