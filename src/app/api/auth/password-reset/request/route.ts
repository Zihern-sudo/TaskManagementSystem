import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { sendMail, buildPasswordResetEmail } from "@/lib/mail";

/** 1-hour reset window */
const RESET_EXPIRY_MS = 60 * 60 * 1000;

// ── POST /api/auth/password-reset/request ─────────────────────────────────
//
// Generates a password-reset token and emails it to the user.
//
// Always responds with the same success message regardless of whether the
// email exists — this prevents account enumeration.

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { email } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !email.trim()) {
    return fail("Email is required.", 422);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Look up the user — silently ignore unknown emails
  const user = await db.user.findUnique({ where: { email: normalizedEmail } });

  // Only send to active users who have a password.
  // Google-only accounts have no password and should use Google SSO.
  if (user && user.status === "active" && user.password) {
    const token = randomBytes(32).toString("hex"); // 64 hex chars / 256-bit entropy
    const expiry = new Date(Date.now() + RESET_EXPIRY_MS);

    await db.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    const { subject, html } = buildPasswordResetEmail(token, baseUrl);

    // Fire-and-forget — same pattern as magic link
    sendMail({ to: user.email, subject, html }).catch(() => null);
  }

  // Always return the same response to prevent email enumeration
  return ok("If that email is registered, a reset link has been sent. It expires in 1 hour.");
}
