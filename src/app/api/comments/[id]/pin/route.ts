import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/comments/[id]/pin ────────────────────────────────────────────
// Toggles the pinned state of a top-level task comment.

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const comment = await db.comment.findUnique({
    where: { id },
    select: { id: true, pinned: true, parentId: true },
  });

  if (!comment) return fail("Comment not found.", 404);
  if (comment.parentId) return fail("Replies cannot be pinned.", 400);

  const newPinned = !comment.pinned;
  await db.comment.update({
    where: { id },
    data: { pinned: newPinned, pinnedAt: newPinned ? new Date() : null },
  });

  return ok(newPinned ? "Comment pinned." : "Comment unpinned.", {
    action: newPinned ? "pinned" : "unpinned",
  });
}
