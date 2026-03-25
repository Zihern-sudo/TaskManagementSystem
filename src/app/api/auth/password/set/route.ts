import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

// Same rules as invite acceptance
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

// ── POST /api/auth/password/set ────────────────────────────────────────────
//
// Allows an authenticated user who signed up via Google SSO (and therefore
// has no password) to set a password so they can also log in with email +
// password in the future.
//
// Guarded: requires an active session (middleware injects x-user-* headers).
// Rejected: if the user already has a password — they should use the
//           standard change-password flow in their profile settings instead.

export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { password } = (body ?? {}) as Record<string, unknown>;

  if (typeof password !== "string" || !PASSWORD_REGEX.test(password)) {
    return fail(
      "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
      422,
    );
  }

  const user = await db.user.findUnique({
    where: { id: caller.id },
    select: { id: true, password: true },
  });
  if (!user) return fail("User not found.", 404);

  if (user.password !== null) {
    return fail("You already have a password. Use the change-password form instead.", 400);
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  return ok("Password set successfully. You can now log in with your email and password.");
}
