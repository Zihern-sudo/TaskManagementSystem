import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { TASK_SELECT, VALID_STATUSES, VALID_PRIORITIES, serializeTask } from "@/app/api/tasks/route";
import { getRequestUser } from "@/lib/session";
import { TaskPriority, TaskStatus } from "@prisma/client";

/**
 * After a subtask status changes, auto-update the parent task status based on
 * subtask completion progress. Automation is one-directional where possible
 * and never overrides statuses the user set manually beyond the automation target.
 *
 * Rules:
 *  - 0 of N done        → no-op (full manual control)
 *  - 1…N-1 of N done   → set parent to "in_progress"
 *                           • forward:  only if parent is currently "not_started"
 *                           • rollback: also fires if parent is "in_review" (was all-done,
 *                             one subtask unchecked → step back to in_progress)
 *                           • skip if already "in_progress" or "completed"
 *  - All N done         → set parent to "in_review"
 *                           • only if parent is currently "not_started" or "in_progress"
 *                           • skip if already "in_review" or "completed"
 *
 * "completed" is always manual — automation never sets or clears it.
 */
export async function syncParentStatus(parentId: string) {
  const parent = await db.task.findUnique({
    where: { id: parentId },
    select: { id: true, status: true, subtasks: { select: { status: true } } },
  });
  if (!parent || parent.subtasks.length === 0) return;

  const total = parent.subtasks.length;
  const completedCount = parent.subtasks.filter((s) => s.status === "completed").length;

  if (completedCount === total) {
    // All subtasks done → advance to "in_review" (review gate before marking Done)
    if (parent.status === "not_started" || parent.status === "in_progress") {
      await db.task.update({ where: { id: parentId }, data: { status: "in_review" } });
    }
  } else if (completedCount >= 1) {
    // Some (not all) subtasks done → target is "in_progress"
    // Fire for "not_started" (forward) and "in_review" (rollback when one unchecked)
    // Skip "in_progress" (already there) and "completed" (manually set — don't revert)
    if (parent.status === "not_started" || parent.status === "in_review") {
      await db.task.update({ where: { id: parentId }, data: { status: "in_progress" } });
    }
  } else {
    // completedCount === 0 — all subtasks unchecked (including the edge case where
    // there is only 1 subtask and it gets unchecked, going from 1/1 → 0/1).
    // If the parent was auto-advanced to "in_review" (all were done), roll it back
    // to "in_progress" now that no subtasks are complete.
    // Leave "not_started", "in_progress", and "completed" untouched.
    if (parent.status === "in_review") {
      await db.task.update({ where: { id: parentId }, data: { status: "in_progress" } });
    }
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

  // Fetch the existing task early so due-date validation can compare against the stored value
  const existing = await db.task.findUnique({
    where: { id },
    select: { id: true, parentId: true, dueDate: true, assignees: { select: { userId: true } } },
  });
  if (!existing) return fail("Task not found.", 404);

  let parsedDueDate: Date | null | undefined;
  if ("dueDate" in data) {
    if (data.dueDate === null) {
      parsedDueDate = null;
    } else {
      parsedDueDate = new Date(data.dueDate as string);
      if (isNaN(parsedDueDate.getTime())) {
        errors.dueDate = ["dueDate must be a valid ISO date string or null."];
      } else {
        // Only reject a past date when the user is setting a NEW date.
        // If the submitted date matches what is already stored (e.g. the due date
        // simply elapsed while the task was open), allow saving other fields without
        // forcing the user to clear the date first.
        const existingDateStr = existing.dueDate
          ? new Date(existing.dueDate).toISOString().slice(0, 10)
          : null;
        const submittedDateStr = parsedDueDate.toISOString().slice(0, 10);
        const isChangingDate = submittedDateStr !== existingDateStr;

        if (isChangingDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (parsedDueDate < today) {
            errors.dueDate = ["Due date cannot be in the past."];
          }
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
