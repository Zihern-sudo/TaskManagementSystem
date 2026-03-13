import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

const BOARD_COMMENT_SELECT = {
  id: true,
  content: true,
  parentId: true,
  author: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  reactions: { select: { emoji: true, userId: true } },
  replies: {
    select: {
      id: true,
      content: true,
      parentId: true,
      author: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      replies: { select: { id: true } }, // depth guard
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  createdAt: true,
  updatedAt: true,
} as const;

function serializeBoardComment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comment: any,
  currentUserId: string
) {
  const reactionMap: Record<string, { count: number; reacted: boolean }> = {};
  for (const r of comment.reactions ?? []) {
    if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reacted: false };
    reactionMap[r.emoji].count++;
    if (r.userId === currentUserId) reactionMap[r.emoji].reacted = true;
  }
  const reactions = Object.entries(reactionMap).map(([emoji, v]) => ({
    emoji,
    count: v.count,
    reacted: v.reacted,
  }));

  return {
    id: comment.id,
    content: comment.content,
    parentId: comment.parentId ?? null,
    author: comment.author,
    reactions,
    replies: (comment.replies ?? []).map((r: unknown) => serializeBoardComment(r, currentUserId)),
    createdAt: new Date(comment.createdAt).toISOString(),
    updatedAt: new Date(comment.updatedAt).toISOString(),
  };
}

// ── GET /api/board-comments ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const comments = await db.boardComment.findMany({
    where: { parentId: null },
    select: BOARD_COMMENT_SELECT,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok("Board comments retrieved.", {
    comments: comments.map((c) => serializeBoardComment(c, caller.id)),
  });
}

// ── POST /api/board-comments ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { content, parentId } = (body ?? {}) as Record<string, unknown>;

  if (typeof content !== "string" || !content.trim()) {
    return fail("Content is required.", 422);
  }

  if (parentId !== undefined && parentId !== null) {
    const parent = await db.boardComment.findUnique({
      where: { id: parentId as string },
      select: { id: true, parentId: true },
    });
    if (!parent) return fail("Parent comment not found.", 404);
    if (parent.parentId) return fail("Replies to replies are not allowed.", 400);
  }

  const comment = await db.boardComment.create({
    data: {
      content: (content as string).trim(),
      authorId: caller.id,
      ...(parentId ? { parentId: parentId as string } : {}),
    },
    select: BOARD_COMMENT_SELECT,
  });

  return ok("Comment posted.", { comment: serializeBoardComment(comment, caller.id) }, 201);
}
