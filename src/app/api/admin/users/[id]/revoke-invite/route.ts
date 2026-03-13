import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/admin/users/[id]/revoke-invite ───────────────────────────────

/**
 * Revoke a pending invitation.
 * Clears the invite token and resets the user's status back to "pending".
 * Only works for users with status "invited".
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!user) {
    return fail("User not found.", 404);
  }

  if (user.status !== "invited") {
    return fail("This user does not have a pending invitation.", 400);
  }

  await db.user.update({
    where: { id },
    data: {
      status: "pending",
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  return ok("Invitation revoked successfully.");
}
