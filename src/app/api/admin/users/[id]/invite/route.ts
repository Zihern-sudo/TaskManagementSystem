import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { sendMail, buildInviteEmail } from "@/lib/mail";

const INVITE_TTL_HOURS = 48;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/users/[id]/invite
 *
 * Generates a secure 48-hour invite link and emails it to the user.
 * Only users with status "pending" or "invited" can be invited.
 * Re-inviting an already-invited user generates a fresh token,
 * invalidating the previous link.
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  // ── Look up user ─────────────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true, status: true },
  });

  if (!user) {
    return fail("User not found.", 404);
  }

  if (user.status === "active") {
    return fail("This user already has an active account and does not need an invitation.", 409);
  }

  // ── Generate token ───────────────────────────────────────────────────────
  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  await db.user.update({
    where: { id },
    data: {
      inviteToken: token,
      inviteTokenExpiry: expiry,
      status: "invited",
    },
  });

  // ── Send email ───────────────────────────────────────────────────────────
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { subject, html } = buildInviteEmail(token, baseUrl);

  try {
    await sendMail({ to: user.email, subject, html });
  } catch (err) {
    console.error("[invite] Failed to send invitation email:", err);
    return fail(
      "User was marked as invited but the email could not be sent. Please try again.",
      500
    );
  }

  return ok(`Invitation sent to ${user.email}. The link expires in ${INVITE_TTL_HOURS} hours.`);
}
