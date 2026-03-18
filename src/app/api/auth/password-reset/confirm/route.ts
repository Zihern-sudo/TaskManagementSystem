import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { setSessionCookie, toSessionPayload } from "@/lib/session";

const MIN_PASSWORD_LENGTH = 8;

// ── POST /api/auth/password-reset/confirm ─────────────────────────────────
//
// Validates the reset token, sets the new password, and signs the user in.

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { token, newPassword } = (body ?? {}) as Record<string, unknown>;

  if (typeof token !== "string" || !token.trim()) {
    return fail("Reset token is required.", 422);
  }

  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 422);
  }

  // Find user by token
  const user = await db.user.findUnique({
    where: { passwordResetToken: token.trim() },
  });

  if (!user || user.status !== "active") {
    return fail("This reset link is invalid or has already been used.", 400);
  }

  // Check expiry
  if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
    return fail("This reset link has expired. Please request a new one.", 400);
  }

  // Hash new password and clear the token in one update
  const hashed = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  // Sign the user in automatically
  await setSessionCookie(toSessionPayload(user));

  return ok("Password updated successfully. You are now signed in.");
}
