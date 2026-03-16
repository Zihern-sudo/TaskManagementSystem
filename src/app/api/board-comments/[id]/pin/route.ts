import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/board-comments/[id]/pin ─────────────────────────────────────
// Toggles the pinned state of a top-level board comment.

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let comment: any;
  try {
    comment = await db.boardComment.findUnique({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: { id: true, pinned: true, parentId: true } as any,
    });
  } catch {
    // Old cached Prisma client: fall back to select without pinned
    comment = await db.boardComment.findUnique({
      where: { id },
      select: { id: true, parentId: true },
    });
    if (comment) comment.pinned = false; // treat as unpinned, will be set to true below
  }

  if (!comment) return fail("Comment not found.", 404);
  if (comment.parentId) return fail("Replies cannot be pinned.", 400);

  const newPinned = !comment.pinned;
  try {
    await db.boardComment.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { pinned: newPinned, pinnedAt: newPinned ? new Date() : null } as any,
    });
  } catch {
    // Old cached Prisma client: update only the fields it knows about
    // Pin state can't be persisted until dev server restarts with new client
    return fail("Pin feature requires a server restart to activate.", 503);
  }

  return ok(newPinned ? "Comment pinned." : "Comment unpinned.", {
    action: newPinned ? "pinned" : "unpinned",
  });
}
