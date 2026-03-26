import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { TASK_SELECT, VALID_STATUSES, VALID_PRIORITIES, serializeTask } from "@/app/api/tasks/route";
import { getRequestUser } from "@/lib/session";
import { TaskPriority, TaskStatus } from "@prisma/client";

/**
 * After a subtask status changes, check whether the parent task's status
 * should be auto-updated based on subtask completion progress.
 *
 * Rules:
 *  - All subtasks completed → set parent to "completed"
 *  - At least one subtask not completed and parent is "completed" → revert parent to "in_progress"
 */
export async function syncParentStatus(parentId: string) {
  const parent = await db.task.findUnique({
    where: { id: parentId },
    select: { id: true, status: true, subtasks: { select: { status: true } } },
  });
  if (!parent) return;

  const allDone = parent.subtasks.length > 0 && parent.subtasks.every((s) => s.status === "completed");
  const anyNotDone = parent.subtasks.some((s) => s.status !== "completed");

  if (allDone && parent.status !== "completed") {
    await db.task.update({ where: { id: parentId }, data: { status: "completed" } });
  } else if (anyNotDone && parent.status === "completed") {
    await db.task.update({ where: { id: parentId }, data: { status: "in_progress" } });
  }
}

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
 * Body: Partial<{ title, description, status, priority, dueDate, assigneeIds, customFieldValues }>
 * Pass null for description or dueDate to clear the field.
 * Pass [] for assigneeIds to remove all assignees.
 * Pass customFieldValues to upsert values; empty string value clears that field.
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

  // Parse custom field values
  const cfValues: { fieldId: string; value: string }[] = [];
  if ("customFieldValues" in data && Array.isArray(data.customFieldValues)) {
    for (const v of data.customFieldValues as unknown[]) {
      const entry = v as Record<string, unknown>;
      if (typeof entry?.fieldId !== "string" || typeof entry?.value !== "string") {
        errors.customFieldValues = ["Each custom field value must have string fieldId and value."];
        break;
      }
      cfValues.push({ fieldId: entry.fieldId, value: entry.value });
    }
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  const existing = await db.task.findUnique({
    where: { id },
    select: { id: true, parentId: true, assignees: { select: { userId: true } } },
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

  // Validate custom field values against schema
  if (cfValues.length > 0) {
    const fieldIds = cfValues.map((v) => v.fieldId);
    const dbFields = await db.customField.findMany({ where: { id: { in: fieldIds } } });
    const fieldMap = new Map(dbFields.map((f) => [f.id, f]));

    for (const v of cfValues) {
      const field = fieldMap.get(v.fieldId);
      if (!field) {
        errors.customFieldValues = ["One or more custom field IDs are invalid."];
        break;
      }
      if (field.type === "picklist" && v.value.trim() && !field.options.includes(v.value)) {
        errors[`customField_${field.fieldKey}`] = [
          `Value for "${field.label}" must be one of: ${field.options.join(", ")}.`,
        ];
      }
    }

    if (Object.keys(errors).length > 0) {
      return fail("Validation failed.", 422, errors);
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

  // Upsert / clear custom field values
  for (const v of cfValues) {
    if (v.value.trim()) {
      await db.taskCustomFieldValue.upsert({
        where: { taskId_fieldId: { taskId: id, fieldId: v.fieldId } },
        create: { taskId: id, fieldId: v.fieldId, value: v.value.trim() },
        update: { value: v.value.trim() },
      });
    } else {
      // Empty string = clear the value
      await db.taskCustomFieldValue.deleteMany({ where: { taskId: id, fieldId: v.fieldId } });
    }
  }

  const task = await db.task.update({
    where: { id },
    data: updateData,
    select: TASK_SELECT,
  });

  // If this is a subtask and its status changed, sync the parent's status
  if ("status" in data && existing.parentId) {
    await syncParentStatus(existing.parentId);
  }

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
