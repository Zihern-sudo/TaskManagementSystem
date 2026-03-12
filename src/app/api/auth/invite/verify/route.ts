import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";

/**
 * GET /api/auth/invite/verify?token=<token>
 *
 * Public endpoint — called by the set-password page on mount to confirm
 * the invite token is still valid before asking the user to set a password.
 *
 * Does NOT consume the token — that happens on POST /api/auth/invite/accept.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || !token.trim()) {
    return fail("A valid token query parameter is required.");
  }

  const user = await db.user.findFirst({
    where: { inviteToken: token },
    select: { fullName: true, email: true, inviteTokenExpiry: true },
  });

  if (!user) {
    return fail("This invitation link is invalid or has already been used.", 401);
  }

  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return fail("This invitation link has expired. Please ask an admin to send a new one.", 401);
  }

  return ok("Invitation token is valid.", {
    name: user.fullName,
    email: user.email,
  });
}
