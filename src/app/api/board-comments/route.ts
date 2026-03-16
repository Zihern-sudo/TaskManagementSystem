import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { sendMail, buildMentionEmail } from "@/lib/mail";

// ── Select shapes ──────────────────────────────────────────────────────────

const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;
const REACTION_SELECT = { emoji: true, userId: true } as const;

/** Nested reply shape — depth guard prevents further nesting */
const REPLY_SELECT = {
  id: true,
  content: true,
  parentId: true,
  pinned: true,
  pinnedAt: true,
  author: { select: AUTHOR_SELECT },
  reactions: { select: REACTION_SELECT },
  replies: { select: { id: true } },
  createdAt: true,
  updatedAt: true,
};

/** Top-level board comment shape */
const BOARD_COMMENT_SELECT = {
  id: true,
  content: true,
  parentId: true,
  pinned: true,
  pinnedAt: true,
  author: { select: AUTHOR_SELECT },
  reactions: { select: REACTION_SELECT },
  replies: {
    select: REPLY_SELECT,
    orderBy: { createdAt: "asc" as const },
  },
  createdAt: true,
  updatedAt: true,
};

// ── Serializer ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeBoardComment(comment: any, currentUserId: string) {
  const reactionMap: Record<string, { count: number; reacted: boolean }> = {};
  for (const r of comment.reactions ?? []) {
    if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reacted: false };
    reactionMap[r.emoji].count++;
    if (r.userId === currentUserId) reactionMap[r.emoji].reacted = true;
  }
  const reactions = Object.entries(reactionMap).map(([emoji, v]) => ({
    emoji, count: v.count, reacted: v.reacted,
  }));

  return {
    id: comment.id,
    content: comment.content,
    parentId: comment.parentId ?? null,
    author: comment.author,
    reactions,
    pinned: comment.pinned ?? false,
    pinnedAt: comment.pinnedAt ? new Date(comment.pinnedAt).toISOString() : null,
    replies: (comment.replies ?? []).map((r: unknown) => serializeBoardComment(r, currentUserId)),
    createdAt: new Date(comment.createdAt).toISOString(),
    updatedAt: new Date(comment.updatedAt).toISOString(),
  };
}

// ── GET /api/board-comments ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeTaskComment(tc: any): Record<string, unknown> {
  return {
    id: tc.id,
    content: tc.content,
    pinned: tc.pinned ?? false,
    pinnedAt: tc.pinnedAt ? new Date(tc.pinnedAt).toISOString() : null,
    author: tc.author,
    task: tc.task,
    replyCount: tc._count?.replies ?? (tc.replies?.length ?? 0),
    replies: (tc.replies ?? []).map((r: any) => ({
      id: r.id,
      content: r.content,
      author: r.author,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    })),
    createdAt: new Date(tc.createdAt).toISOString(),
    updatedAt: new Date(tc.updatedAt).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  // ── Board comments (independent query with pin fallback) ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let serializedComments: any[] = [];
  try {
    const rawComments = await db.boardComment.findMany({
      where: { parentId: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: BOARD_COMMENT_SELECT as any,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const pinned = (rawComments as any[])
      .filter((c) => c.pinned)
      .sort((a, b) => (b.pinnedAt?.getTime?.() ?? 0) - (a.pinnedAt?.getTime?.() ?? 0));
    const nonPinned = (rawComments as any[]).filter((c) => !c.pinned);
    serializedComments = [...pinned, ...nonPinned].map((c) => serializeBoardComment(c, caller.id));
  } catch {
    // Prisma client not regenerated yet — fetch without pin fields
    try {
      const rawComments = await db.boardComment.findMany({
        where: { parentId: null },
        select: {
          id: true, content: true, parentId: true,
          author: { select: AUTHOR_SELECT },
          reactions: { select: REACTION_SELECT },
          replies: {
            select: {
              id: true, content: true, parentId: true,
              author: { select: AUTHOR_SELECT },
              reactions: { select: REACTION_SELECT },
              replies: { select: { id: true } },
              createdAt: true, updatedAt: true,
            },
            orderBy: { createdAt: "asc" as const },
          },
          createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      serializedComments = rawComments.map((c) => serializeBoardComment(c, caller.id));
    } catch (err) {
      console.error("[board-comments GET] Board comments query failed:", err);
      return fail("Failed to load board comments.", 500);
    }
  }

  // ── Task comments (independent query with pin fallback) ───────────────────
  const REPLY_SELECT_TC = {
    id: true,
    content: true,
    author: { select: { id: true, fullName: true, avatarUrl: true } },
    createdAt: true,
    updatedAt: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let serializedTaskComments: any[] = [];
  try {
    const taskComments = await db.comment.findMany({
      where: { parentId: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: {
        id: true,
        content: true,
        pinned: true,
        pinnedAt: true,
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        task: { select: { id: true, title: true } },
        replies: { select: REPLY_SELECT_TC, orderBy: { createdAt: "asc" as const } },
        _count: { select: { replies: true } },
        createdAt: true,
        updatedAt: true,
      } as any,
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    serializedTaskComments = (taskComments as any[]).map(serializeTaskComment);
  } catch {
    // Prisma client doesn't know about pinned/pinnedAt on Comment yet
    try {
      const taskComments = await db.comment.findMany({
        where: { parentId: null },
        select: {
          id: true,
          content: true,
          author: { select: { id: true, fullName: true, avatarUrl: true } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          task: { select: { id: true, title: true } } as any,
          replies: { select: REPLY_SELECT_TC, orderBy: { createdAt: "asc" as const } },
          _count: { select: { replies: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      serializedTaskComments = (taskComments as any[]).map(serializeTaskComment);
    } catch (err) {
      console.error("[board-comments GET] Task comments query failed:", err);
      // Non-fatal: return board comments even if task comments fail
      serializedTaskComments = [];
    }
  }

  return ok("Board comments retrieved.", {
    comments: serializedComments,
    taskComments: serializedTaskComments,
  });
}

// ── POST /api/board-comments ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { content, parentId, mentionedUserIds } = (body ?? {}) as Record<string, unknown>;

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

  let comment: any;
  try {
    comment = await db.boardComment.create({
      data: {
        content: (content as string).trim(),
        authorId: caller.id,
        ...(parentId ? { parentId: parentId as string } : {}),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: BOARD_COMMENT_SELECT as any,
    });
  } catch {
    // Fallback: create without pinned/pinnedAt for old cached Prisma client
    comment = await db.boardComment.create({
      data: {
        content: (content as string).trim(),
        authorId: caller.id,
        ...(parentId ? { parentId: parentId as string } : {}),
      },
      select: {
        id: true, content: true, parentId: true,
        author: { select: AUTHOR_SELECT },
        reactions: { select: REACTION_SELECT },
        replies: { select: { id: true, content: true, parentId: true, author: { select: AUTHOR_SELECT }, reactions: { select: REACTION_SELECT }, replies: { select: { id: true } }, createdAt: true, updatedAt: true }, orderBy: { createdAt: "asc" as const } },
        createdAt: true, updatedAt: true,
      },
    });
  }

  // ── Send mention email notifications (fire-and-forget) ────────────────────
  const mentionIds = Array.isArray(mentionedUserIds)
    ? (mentionedUserIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];

  if (mentionIds.length > 0) {
    const uniqueIds = [...new Set(mentionIds)].filter((id) => id !== caller.id);
    if (uniqueIds.length > 0) {
      db.user
        .findMany({
          where: { id: { in: uniqueIds }, status: "active" },
          select: { email: true },
        })
        .then((mentionedUsers) => {
          const baseUrl =
            process.env.NEXTAUTH_URL ??
            process.env.NEXT_PUBLIC_APP_URL ??
            "http://localhost:3000";
          const { subject, html } = buildMentionEmail(
            caller.name,
            (content as string).trim(),
            baseUrl
          );
          for (const u of mentionedUsers) {
            sendMail({ to: u.email, subject, html }).catch(() => null);
          }
        })
        .catch(() => null);
    }
  }

  return ok("Comment posted.", { comment: serializeBoardComment(comment, caller.id) }, 201);
}
