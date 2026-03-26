import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { SUBTASK_SELECT, VALID_PRIORITIES, VALID_STATUSES, serializeSubtask } from "@/app/api/tasks/route";
import { syncParentStatus } from "@/app/api/tasks/[id]/route";
import { TaskPriority, TaskStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/tasks/[id]/subtasks ───────────────────────────────────────────

/**
 * Returns all subtasks for a given parent task, ordered by creation date.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const parent = await db.task.findUnique({ where: { id }, select: { id: true } });
  if (!parent) return fail("Task not found.", 404);

  const subtasks = await db.task.findMany({
    where: { parentId: id },
    select: SUBTASK_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return ok("Subtasks retrieved successfully.", { subtasks: subtasks.map(serializeSubtask) });
}

// ── POST /api/tasks/[id]/subtasks ──────────────────────────────────────────

/**
 * Creates a new subtask under the given parent task.
 *
 * Body:
 *   title       string        (required)
 *   status      TaskStatus    (optional, default: not_started)
 *   priority    TaskPriority  (optional, default: medium)
 *   assigneeIds string[]      (optional, up to 5 user IDs)
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: parentId } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can create subtasks.", 403);

  // Verify parent exists and is itself a top-level task (no deeper nesting)
  const parent = await db.task.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
  if (!parent) return fail("Parent task not found.", 404);
  if (parent.parentId !== null) return fail("Subtasks cannot be nested more than one level deep.", 422);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { title, status, priority, assigneeIds } = (body ?? {}) as Record<string, unknown>;

  const errors: Record<string, string[]> = {};

  if (typeof title !== "string" || !title.trim()) {
    errors.title = ["Title is required."];
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as TaskStatus)) {
    errors.status = [`Status must be one of: ${VALID_STATUSES.join(", ")}.`];
  }

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority as TaskPriority)) {
    errors.priority = [`Priority must be one of: ${VALID_PRIORITIES.join(", ")}.`];
  }

  const ids: string[] = [];
  if (assigneeIds !== undefined && assigneeIds !== null) {
    if (!Array.isArray(assigneeIds)) {
      errors.assigneeIds = ["assigneeIds must be an array of user IDs."];
    } else if ((assigneeIds as unknown[]).length > 5) {
      errors.assigneeIds = ["Maximum 5 assignees allowed."];
    } else {
      ids.push(...(assigneeIds as string[]));
    }
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  if (ids.length > 0) {
    const found = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) return fail("One or more assignees not found.", 404);
  }

  const subtask = await db.task.create({
    data: {
      title: (title as string).trim(),
      parentId,
      ...(status !== undefined && { status: status as TaskStatus }),
      ...(priority !== undefined && { priority: priority as TaskPriority }),
      ...(ids.length > 0 && {
        assignees: { create: ids.map((userId) => ({ userId })) },
      }),
    },
    select: SUBTASK_SELECT,
  });

  // Sync parent status after adding a subtask
  await syncParentStatus(parentId);

  return ok("Subtask created successfully.", { subtask: serializeSubtask(subtask) }, 201);
}
