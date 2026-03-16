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

export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  try {
    // Fetch board comments (with pin fields)
    const rawComments = await db.boardComment.findMany({
      where: { parentId: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: BOARD_COMMENT_SELECT as any,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Pinned comments first (most recently pinned), then by createdAt desc
    const pinned = (rawComments as any[])
      .filter((c) => c.pinned)
      .sort((a, b) => (b.pinnedAt?.getTime?.() ?? 0) - (a.pinnedAt?.getTime?.() ?? 0));
    const nonPinned = (rawComments as any[]).filter((c) => !c.pinned);
    const sortedComments = [...pinned, ...nonPinned];

    // Recent task comments (Task Activity tab)
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
        _count: { select: { replies: true } },
        createdAt: true,
        updatedAt: true,
      } as any,
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return ok("Board comments retrieved.", {
      comments: sortedComments.map((c) => serializeBoardComment(c, caller.id)),
      taskComments: (taskComments as any[]).map((tc) => ({
        id: tc.id,
        content: tc.content,
        pinned: tc.pinned ?? false,
        pinnedAt: tc.pinnedAt ? new Date(tc.pinnedAt).toISOString() : null,
        author: tc.author,
        task: tc.task,
        replyCount: tc._count?.replies ?? 0,
        createdAt: new Date(tc.createdAt).toISOString(),
        updatedAt: new Date(tc.updatedAt).toISOString(),
      })),
    });
  } catch (err) {
    // If new fields (pinned/pinnedAt) aren't recognised by the cached Prisma
    // client, fall back to the original query without those fields so the
    // board discussion stays functional until the dev server is restarted.
    console.error("[board-comments GET] Primary query failed, trying fallback:", err);

    try {
      const comments = await db.boardComment.findMany({
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

      const taskComments = await db.comment.findMany({
        where: { parentId: null },
        select: {
          id: true, content: true,
          author: { select: { id: true, fullName: true, avatarUrl: true } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          task: { select: { id: true, title: true } } as any,
          _count: { select: { replies: true } },
          createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      return ok("Board comments retrieved.", {
        comments: comments.map((c) => serializeBoardComment(c, caller.id)),
        taskComments: (taskComments as any[]).map((tc) => ({
          id: tc.id,
          content: tc.content,
          pinned: false,
          pinnedAt: null,
          author: tc.author,
          task: tc.task,
          replyCount: tc._count?.replies ?? 0,
          createdAt: new Date(tc.createdAt).toISOString(),
          updatedAt: new Date(tc.updatedAt).toISOString(),
        })),
      });
    } catch (fallbackErr) {
      console.error("[board-comments GET] Fallback also failed:", fallbackErr);
      return fail("Failed to load board comments.", 500);
    }
  }
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
