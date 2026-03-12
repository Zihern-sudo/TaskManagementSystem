import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { TASK_SELECT, VALID_STATUSES, VALID_PRIORITIES } from "@/app/api/tasks/route";
import { TaskPriority, TaskStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/tasks/[id] ────────────────────────────────────────────────────

/**
 * Returns a single task by ID.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const task = await db.task.findUnique({ where: { id }, select: TASK_SELECT });
  if (!task) return fail("Task not found.", 404);

  return ok("Task retrieved successfully.", { task });
}

// ── PATCH /api/tasks/[id] ──────────────────────────────────────────────────

/**
 * Updates any combination of a task's fields.
 *
 * Body: Partial<{ title, description, status, priority, dueDate, assignedUserId }>
 * Pass null for description, dueDate, or assignedUserId to clear the field.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

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
      }
    }
  }

  if ("assignedUserId" in data && data.assignedUserId !== null && typeof data.assignedUserId !== "string") {
    errors.assignedUserId = ["assignedUserId must be a string or null."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Existence checks ──────────────────────────────────────────────────────
  const existing = await db.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail("Task not found.", 404);

  if ("assignedUserId" in data && data.assignedUserId !== null) {
    const userExists = await db.user.findUnique({
      where: { id: data.assignedUserId as string },
      select: { id: true },
    });
    if (!userExists) return fail("Assigned user not found.", 404);
  }

  // ── Build update payload ──────────────────────────────────────────────────
  const updateData: Record<string, unknown> = {};
  if ("title" in data) updateData.title = (data.title as string).trim();
  if ("description" in data) updateData.description = data.description ?? null;
  if ("status" in data) updateData.status = data.status;
  if ("priority" in data) updateData.priority = data.priority;
  if ("dueDate" in data) updateData.dueDate = parsedDueDate ?? null;
  if ("assignedUserId" in data) updateData.assignedUserId = data.assignedUserId ?? null;

  const task = await db.task.update({
    where: { id },
    data: updateData,
    select: TASK_SELECT,
  });

  return ok("Task updated successfully.", { task });
}

// ── DELETE /api/tasks/[id] ─────────────────────────────────────────────────

/**
 * Deletes a task and all its comments (cascade is defined in the schema).
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const existing = await db.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail("Task not found.", 404);

  await db.task.delete({ where: { id } });

  return ok("Task and all associated comments deleted successfully.");
}
