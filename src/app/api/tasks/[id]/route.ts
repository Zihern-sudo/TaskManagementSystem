import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { TASK_SELECT, VALID_STATUSES, VALID_PRIORITIES, serializeTask } from "@/app/api/tasks/route";
import { getRequestUser } from "@/lib/session";
import { TaskPriority, TaskStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/tasks/[id] ────────────────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const task = await db.task.findUnique({ where: { id }, select: TASK_SELECT });
  if (!task) return fail("Task not found.", 404);

  return ok("Task retrieved successfully.", { task: serializeTask(task) });
}

// ── PATCH /api/tasks/[id] ──────────────────────────────────────────────────

/**
 * Updates any combination of a task's fields.
 *
 * Body: Partial<{ title, description, status, priority, dueDate, assigneeIds }>
 * Pass null for description or dueDate to clear the field.
 * Pass [] for assigneeIds to remove all assignees.
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

  const data = (body ?? {}) as Record<string, unknown>;

  if (Object.keys(data).length === 0) {
    return fail("Provide at least one field to update.");
  }

  // Non-admins cannot change assignees
  if (caller.role !== "admin" && "assigneeIds" in data) {
    return fail("Only admins can change task assignees.", 403);
  }

  const errors: Record<string, string[]> = {};

  if ("title" in data && (typeof data.title !== "string" || !data.title.trim())) {
    errors.title = ["Title must be a non-empty string."];
  }

  if ("status" in data && !VALID_STATUSES.includes(data.status as TaskStatus)) {
    errors.status = [`Status must be one of: ${VALID_STATUSES.join(", ")}.`];
  }

  if ("priority" in data && !VALID_PRIORITIES.includes(data.priority as TaskPriority)) {
    errors.priority = [`Priority must be one of: ${VALID_PRIORITIES.join(", ")}.`];
  }

  let parsedDueDate: Date | null | undefined;
  if ("dueDate" in data) {
    if (data.dueDate === null) {
      parsedDueDate = null;
    } else {
      parsedDueDate = new Date(data.dueDate as string);
      if (isNaN(parsedDueDate.getTime())) {
        errors.dueDate = ["dueDate must be a valid ISO date string or null."];
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDueDate < today) {
          errors.dueDate = ["Due date cannot be in the past."];
        }
      }
    }
  }

  const ids: string[] | undefined =
    "assigneeIds" in data
      ? Array.isArray(data.assigneeIds)
        ? (data.assigneeIds as string[])
        : undefined
      : undefined;

  if ("assigneeIds" in data && ids === undefined) {
    errors.assigneeIds = ["assigneeIds must be an array."];
  } else if (ids && ids.length > 5) {
    errors.assigneeIds = ["Maximum 5 assignees allowed."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  const existing = await db.task.findUnique({
    where: { id },
    select: { id: true, assignees: { select: { userId: true } } },
  });
  if (!existing) return fail("Task not found.", 404);

  // Members can only edit tasks they are assigned to
  if (caller.role !== "admin") {
    const isAssigned = existing.assignees.some((a) => a.userId === caller.id);
    if (!isAssigned) return fail("You can only edit tasks assigned to you.", 403);
  }

  // Verify assignees exist
  if (ids && ids.length > 0) {
    const found = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) {
      return fail("One or more assignees not found.", 404);
    }
  }

  // ── Build update payload ──────────────────────────────────────────────────
  const updateData: Record<string, unknown> = {};
  if ("title" in data) updateData.title = (data.title as string).trim();
  if ("description" in data) updateData.description = data.description ?? null;
  if ("status" in data) updateData.status = data.status;
  if ("priority" in data) updateData.priority = data.priority;
  if ("dueDate" in data) updateData.dueDate = parsedDueDate ?? null;

  // Replace assignees if provided
  if (ids !== undefined) {
    await db.taskAssignee.deleteMany({ where: { taskId: id } });
    if (ids.length > 0) {
      await db.taskAssignee.createMany({
        data: ids.map((userId) => ({ taskId: id, userId })),
        skipDuplicates: true,
      });
    }
  }

  const task = await db.task.update({
    where: { id },
    data: updateData,
    select: TASK_SELECT,
  });

  return ok("Task updated successfully.", { task: serializeTask(task) });
}

// ── DELETE /api/tasks/[id] ─────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const existing = await db.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail("Task not found.", 404);

  await db.task.delete({ where: { id } });

  return ok("Task and all associated comments deleted successfully.");
}
