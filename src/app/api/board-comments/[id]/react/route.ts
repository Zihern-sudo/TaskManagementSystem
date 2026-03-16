import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_EMOJIS = ["👍", "❤️", "🎉", "🔥", "😂", "🙌"];

// ── POST /api/board-comments/[id]/react ───────────────────────────────────
// Toggles a reaction (add if not present, remove if already present).

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { emoji } = (body ?? {}) as Record<string, unknown>;

  if (typeof emoji !== "string" || !ALLOWED_EMOJIS.includes(emoji)) {
    return fail(`emoji must be one of: ${ALLOWED_EMOJIS.join(" ")}.`, 422);
  }

  const comment = await db.boardComment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) return fail("Comment not found.", 404);

  const deleted = await db.boardReaction.deleteMany({
    where: { commentId: id, userId: caller.id, emoji },
  });

  if (deleted.count > 0) {
    return ok("Reaction removed.", { action: "removed", emoji });
  } else {
    await db.boardReaction.create({ data: { commentId: id, userId: caller.id, emoji } });
    return ok("Reaction added.", { action: "added", emoji }, 201);
  }
}
