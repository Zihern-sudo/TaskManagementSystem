import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { TaskPriority, TaskStatus } from "@prisma/client";

// ── Shared constants ───────────────────────────────────────────────────────

export const VALID_STATUSES = Object.values(TaskStatus);
export const VALID_PRIORITIES = Object.values(TaskPriority);

// ── Shared select shape ────────────────────────────────────────────────────

// Lightweight shape used for subtasks nested inside a parent task
export const SUBTASK_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  assignees: {
    select: {
      user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
    orderBy: { assignedAt: "asc" as const },
  },
  createdAt: true,
  updatedAt: true,
} as const;

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  parentId: true,
  assignees: {
    select: {
      user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
    orderBy: { assignedAt: "asc" as const },
  },
  customFieldValues: {
    select: {
      field: {
        select: { id: true, label: true, fieldKey: true, type: true, order: true },
      },
      value: true,
    },
  },
  subtasks: { select: SUBTASK_SELECT, orderBy: { createdAt: "asc" as const } },
  createdAt: true,
  updatedAt: true,
} as const;

// Flatten assignees from join table and custom field values to clean shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeSubtask(subtask: any) {
  return {
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
    priority: subtask.priority,
    assignees: subtask.assignees.map((a: { user: unknown }) => a.user),
    createdAt: new Date(subtask.createdAt).toISOString(),
    updatedAt: new Date(subtask.updatedAt).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeTask(task: any) {
  const { customFieldValues, subtasks, ...rest } = task;
  const serializedSubtasks = (subtasks ?? []).map(serializeSubtask);
  const subtaskCount = serializedSubtasks.length;
  const completedSubtaskCount = serializedSubtasks.filter(
    (s: { status: string }) => s.status === "completed"
  ).length;
  return {
    ...rest,
    assignees: task.assignees.map((a: { user: unknown }) => a.user),
    customFields: ((customFieldValues ?? []) as Array<{
      field: { id: string; label: string; fieldKey: string; type: string; order: number };
      value: string;
    }>)
      .sort((a, b) => (a.field.order ?? 0) - (b.field.order ?? 0))
      .map((v) => ({
        fieldId: v.field.id,
        fieldKey: v.field.fieldKey,
        label: v.field.label,
        type: v.field.type,
        value: v.value,
      })),
    subtasks: serializedSubtasks,
    subtaskCount,
    completedSubtaskCount,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}

// ── GET /api/tasks ─────────────────────────────────────────────────────────

/**
 * Returns all top-level tasks (parentId = null) ordered by creation date (newest first).
 * Subtasks are excluded from this list — they appear nested inside their parent via GET /api/tasks/[id].
 */
export async function GET() {
  const tasks = await db.task.findMany({
    where: { parentId: null },
    select: TASK_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return ok("Tasks retrieved successfully.", { tasks: tasks.map(serializeTask) });
}

// ── POST /api/tasks ────────────────────────────────────────────────────────

/**
 * Creates a new task.
 *
 * Body:
 *   title              string    (required)
 *   description        string    (optional)
 *   status             TaskStatus   (optional, default: not_started)
 *   priority           TaskPriority (optional, default: medium)
 *   dueDate            ISO date string (optional)
 *   assigneeIds        string[]  (optional, up to 5 user IDs)
 *   customFieldValues  { fieldId: string; value: string }[]  (optional)
 */
export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can create tasks.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const {
    title,
    description,
    status,
    priority,
    dueDate,
    assigneeIds,
    customFieldValues,
    parentId,
  } = (body ?? {}) as Record<string, unknown>;

  // ── Validate core fields ───────────────────────────────────────────────
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

  let parsedDueDate: Date | undefined;
  if (dueDate !== undefined) {
    parsedDueDate = new Date(dueDate as string);
    if (isNaN(parsedDueDate.getTime())) {
      errors.dueDate = ["dueDate must be a valid ISO date string."];
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDueDate < today) {
        errors.dueDate = ["Due date cannot be in the past."];
      }
    }
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

  // ── Parse and format-validate custom field values ─────────────────────
  const cfValues: { fieldId: string; value: string }[] = [];
  if (customFieldValues !== undefined && Array.isArray(customFieldValues)) {
    for (const v of customFieldValues as unknown[]) {
      const entry = v as Record<string, unknown>;
      if (typeof entry?.fieldId !== "string" || typeof entry?.value !== "string") {
        errors.customFieldValues = ["Each custom field value must have string fieldId and value."];
        break;
      }
      cfValues.push({ fieldId: entry.fieldId, value: entry.value });
    }
  }

  // Validate parentId if provided
  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== "string") {
      errors.parentId = ["parentId must be a string task ID."];
    }
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Validate parentId references a top-level task ─────────────────────
  if (parentId && typeof parentId === "string") {
    const parent = await db.task.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
    if (!parent) return fail("Parent task not found.", 404);
    if (parent.parentId !== null) return fail("Subtasks cannot be nested more than one level deep.", 422);
  }

  // ── Verify assignees exist ─────────────────────────────────────────────
  if (ids.length > 0) {
    const found = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) {
      return fail("One or more assignees not found.", 404);
    }
  }

  // ── Validate custom fields against schema ─────────────────────────────
  const allFields = await db.customField.findMany();
  const fieldMap = new Map(allFields.map((f) => [f.id, f]));

  // Required field check
  for (const field of allFields) {
    if (field.required) {
      const provided = cfValues.find((v) => v.fieldId === field.id);
      if (!provided || !provided.value.trim()) {
        errors[`customField_${field.fieldKey}`] = [`${field.label} is required.`];
      }
    }
  }

  // Picklist value check
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

  // ── Create task ────────────────────────────────────────────────────────
  const validCfValues = cfValues.filter((v) => v.value.trim());

  const task = await db.task.create({
    data: {
      title: (title as string).trim(),
      ...(description !== undefined && { description: typeof description === "string" ? description.trim() || null : null }),
      ...(status !== undefined && { status: status as TaskStatus }),
      ...(priority !== undefined && { priority: priority as TaskPriority }),
      ...(parsedDueDate !== undefined && { dueDate: parsedDueDate }),
      ...(parentId && typeof parentId === "string" && { parentId }),
      ...(ids.length > 0 && {
        assignees: { create: ids.map((userId) => ({ userId })) },
      }),
      ...(validCfValues.length > 0 && {
        customFieldValues: {
          create: validCfValues.map((v) => ({ fieldId: v.fieldId, value: v.value.trim() })),
        },
      }),
    },
    select: TASK_SELECT,
  });

  return ok("Task created successfully.", { task: serializeTask(task) }, 201);
}
