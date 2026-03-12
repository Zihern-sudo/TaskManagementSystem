import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// ── PATCH /api/comments/[id] ───────────────────────────────────────────────

/**
 * Edits a comment's content.
 * Only the comment's author may edit it.
 *
 * Body: { content: string }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { content } = (body ?? {}) as Record<string, unknown>;

  if (typeof content !== "string" || !content.trim()) {
    return fail("content must be a non-empty string.", 422);
  }

  // ── Look up comment ───────────────────────────────────────────────────────
  const comment = await db.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });

  if (!comment) return fail("Comment not found.", 404);

  if (comment.authorId !== caller.id) {
    return fail("You can only edit your own comments.", 403);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  const updated = await db.comment.update({
    where: { id },
    data: { content: content.trim() },
    select: {
      id: true,
      content: true,
      parentId: true,
      author: { select: { id: true, fullName: true, email: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok("Comment updated successfully.", { comment: updated });
}

// ── DELETE /api/comments/[id] ──────────────────────────────────────────────

/**
 * Deletes a comment and its replies (cascade defined in schema).
 *
 * - Authors can delete their own comments.
 * - Admins can delete any comment.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const comment = await db.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });

  if (!comment) return fail("Comment not found.", 404);

  const isOwner = comment.authorId === caller.id;
  const isAdmin = caller.role === "admin";

  if (!isOwner && !isAdmin) {
    return fail("You can only delete your own comments.", 403);
  }

  await db.comment.delete({ where: { id } });

  return ok("Comment deleted successfully.");
}
