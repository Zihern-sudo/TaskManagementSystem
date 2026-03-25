import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { setSessionCookie, toSessionPayload } from "@/lib/session";

// Minimum password requirements
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

/**
 * POST /api/auth/invite/accept
 *
 * Public endpoint — the user submits their chosen password alongside the
 * invite token from the email link.
 *
 * On success:
 * - Token is cleared (single-use)
 * - Account status is set to "active"
 * - Password is hashed and saved
 * - A session cookie is issued so the user is immediately logged in
 */
export async function POST(req: NextRequest) {
  // ── Parse body ───────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { token, password } = (body ?? {}) as Record<string, unknown>;

  // ── Validate inputs ──────────────────────────────────────────────────────
  const errors: Record<string, string[]> = {};

  if (typeof token !== "string" || !token.trim()) {
    errors.token = ["Invite token is required."];
  }

  if (typeof password !== "string" || !password) {
    errors.password = ["Password is required."];
  } else {
    const pwErrors: string[] = [];
    if (password.length < MIN_PASSWORD_LENGTH) {
      pwErrors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (!PASSWORD_REGEX.test(password)) {
      pwErrors.push(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
    }
    if (pwErrors.length > 0) errors.password = pwErrors;
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Look up token ─────────────────────────────────────────────────────────
  const user = await db.user.findFirst({
    where: { inviteToken: token as string },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      inviteTokenExpiry: true,
    },
  });

  // Clear the token immediately regardless of outcome (single-use guarantee,
  // also prevents timing-based probing of valid tokens).
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { inviteToken: null, inviteTokenExpiry: null },
    });
  }

  if (!user) {
    return fail("This invitation link is invalid or has already been used.", 401);
  }

  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return fail("This invitation link has expired. Please ask an admin to send a new one.", 401);
  }

  if (user.status === "active") {
    return fail("This account is already active. Please log in normally.", 409);
  }

  // ── Hash password and activate account ───────────────────────────────────
  const hashedPassword = await bcrypt.hash(password as string, 12);

  const activated = await db.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      hasSetPassword: true,
      status: "active",
    },
    select: { id: true, fullName: true, email: true, role: true },
  });

  // ── Issue session so the user is immediately logged in ───────────────────
  await setSessionCookie(toSessionPayload(activated));

  return ok("Account activated successfully. You are now logged in.", {
    user: {
      id: activated.id,
      email: activated.email,
      name: activated.fullName,
      role: activated.role,
    },
  });
}
