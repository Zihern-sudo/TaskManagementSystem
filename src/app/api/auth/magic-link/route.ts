import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { sendMail, buildMagicLinkEmail } from "@/lib/mail";

const MAGIC_LINK_TTL_MINUTES = 15;

/**
 * POST /api/auth/magic-link
 *
 * Body: { email: string }
 *
 * Generates a single-use magic link and sends it to the provided email.
 * Always returns success to prevent email enumeration.
 */
export async function POST(req: NextRequest) {
  // ── Parse body ───────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    typeof (body as { email: unknown }).email !== "string"
  ) {
    return fail("email is required.");
  }

  const email = (body as { email: string }).email.toLowerCase().trim();

  if (!email) {
    return fail("email must be a non-empty string.");
  }

  // ── Look up user — silently ignore unknown / inactive emails ─────────────
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (user && user.status === "active") {
    // Generate a 64-character hex token (256 bits of entropy)
    const token = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: token,
        magicLinkExpiry: expiry,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const { subject, html } = buildMagicLinkEmail(token, baseUrl);

    // Fire-and-forget — do not surface SMTP errors to the client
    sendMail({ to: email, subject, html }).catch((err) =>
      console.error("[magic-link] Failed to send email:", err)
    );
  }

  // Always return the same response to prevent account enumeration
  return ok(
    `If an active account exists for ${email}, a magic link has been sent. It expires in ${MAGIC_LINK_TTL_MINUTES} minutes.`
  );
}
