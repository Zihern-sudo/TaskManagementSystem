import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// ── PATCH /api/board-comments/[id] ────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const comment = await db.boardComment.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!comment) return fail("Comment not found.", 404);

  const canEdit = comment.authorId === caller.id || caller.role === "admin";
  if (!canEdit) return fail("Forbidden.", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }
  const { content } = (body ?? {}) as Record<string, unknown>;

  if (typeof content !== "string" || !content.trim()) {
    return fail("Content is required.", 422);
  }

  const updated = await db.boardComment.update({
    where: { id },
    data: { content: content.trim() },
    select: { id: true, content: true, updatedAt: true },
  });

  return ok("Comment updated.", { comment: updated });
}

// ── DELETE /api/board-comments/[id] ───────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const comment = await db.boardComment.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!comment) return fail("Comment not found.", 404);

  const canDelete = comment.authorId === caller.id || caller.role === "admin";
  if (!canDelete) return fail("Forbidden.", 403);

  await db.boardComment.delete({ where: { id } });

  return ok("Comment deleted.");
}
