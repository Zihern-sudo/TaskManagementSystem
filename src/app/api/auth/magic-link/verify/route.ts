import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { setSessionCookie, toSessionPayload } from "@/lib/session";

/**
 * GET /api/auth/magic-link/verify?token=<token>
 *
 * Validates the one-time magic link token and issues a session cookie.
 *
 * Security guarantees:
 * - Token is single-use: cleared from the DB immediately upon verification.
 * - Token expires after 15 minutes.
 * - Account must be active.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || typeof token !== "string" || !token.trim()) {
    return fail("A valid token query parameter is required.");
  }

  // ── Look up the token ────────────────────────────────────────────────────
  const user = await db.user.findFirst({
    where: { magicLinkToken: token },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      magicLinkExpiry: true,
    },
  });

  // Immediately invalidate the token regardless of outcome, so that even an
  // expired or already-used token cannot be probed for a valid user.
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { magicLinkToken: null, magicLinkExpiry: null },
    });
  }

  if (!user) {
    return fail("Invalid or expired magic link.", 401);
  }

  if (!user.magicLinkExpiry || user.magicLinkExpiry < new Date()) {
    return fail("This magic link has expired. Please request a new one.", 401);
  }

  if (user.status !== "active") {
    return fail("Your account is not active. Please contact an administrator.", 403);
  }

  // ── Issue session ────────────────────────────────────────────────────────
  await setSessionCookie(toSessionPayload(user));

  return ok("Logged in successfully via magic link.", {
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
    },
  });
}
