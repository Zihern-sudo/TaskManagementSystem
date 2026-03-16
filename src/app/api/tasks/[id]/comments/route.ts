import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { sendMail, buildMentionEmail } from "@/lib/mail";

type RouteContext = { params: Promise<{ id: string }> };

const AUTHOR_SELECT = { id: true, fullName: true, email: true } as const;

// ── GET /api/tasks/[id]/comments ───────────────────────────────────────────

/**
 * Returns all comments for a task as a nested structure:
 * top-level comments each carry a `replies` array of their direct children.
 *
 * Only one level of nesting is supported; replies do not contain their own
 * `replies` array (the schema prevents deeper nesting at write time).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: taskId } = await ctx.params;

  const taskExists = await db.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!taskExists) return fail("Task not found.", 404);

  // Fetch top-level comments with their replies in a single query
  const comments = await db.comment.findMany({
    where: { taskId, parentId: null },
    select: {
      id: true,
      content: true,
      author: { select: AUTHOR_SELECT },
      createdAt: true,
      updatedAt: true,
      replies: {
        select: {
          id: true,
          content: true,
          author: { select: AUTHOR_SELECT },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok("Comments retrieved successfully.", { comments });
}

// ── POST /api/tasks/[id]/comments ─────────────────────────────────────────

/**
 * Posts a comment or a reply on a task.
 *
 * Body:
 *   content   string  (required)
 *   parentId  string  (optional — the top-level comment being replied to)
 *
 * Rules:
 * - parentId must belong to the same task.
 * - parentId must be a top-level comment (parentId === null) — only one level
 *   of nesting is allowed.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: taskId } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { content, parentId, mentionedUserIds } = (body ?? {}) as Record<string, unknown>;

  // ── Validate ──────────────────────────────────────────────────────────────
  const errors: Record<string, string[]> = {};

  if (typeof content !== "string" || !content.trim()) {
    errors.content = ["Content is required."];
  }

  if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
    errors.parentId = ["parentId must be a string or null."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Existence checks ──────────────────────────────────────────────────────
  const taskExists = await db.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!taskExists) return fail("Task not found.", 404);

  if (parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parentId as string },
      select: { id: true, taskId: true, parentId: true },
    });

    if (!parent) {
      return fail("Parent comment not found.", 404);
    }
    if (parent.taskId !== taskId) {
      return fail("Parent comment does not belong to this task.", 400);
    }
    if (parent.parentId !== null) {
      return fail("Replies to replies are not allowed. Only one level of nesting is supported.", 400);
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────
  const comment = await db.comment.create({
    data: {
      content: (content as string).trim(),
      taskId,
      authorId: caller.id,
      ...(parentId ? { parentId: parentId as string } : {}),
    },
    select: {
      id: true,
      content: true,
      parentId: true,
      author: { select: AUTHOR_SELECT },
      createdAt: true,
      updatedAt: true,
    },
  });

  // ── Mention email notifications (fire-and-forget) ─────────────────────────
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

  return ok("Comment posted successfully.", { comment }, 201);
}
