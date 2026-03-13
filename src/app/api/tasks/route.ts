import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { TaskPriority, TaskStatus } from "@prisma/client";

// ── Shared constants ───────────────────────────────────────────────────────

export const VALID_STATUSES = Object.values(TaskStatus);
export const VALID_PRIORITIES = Object.values(TaskPriority);

// ── Shared select shape ────────────────────────────────────────────────────

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  assignees: {
    select: {
      user: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { assignedAt: "asc" as const },
  },
  createdAt: true,
  updatedAt: true,
} as const;

// Flatten assignees from join table to plain user array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeTask(task: any) {
  return {
    ...task,
    assignees: task.assignees.map((a: { user: unknown }) => a.user),
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}

// ── GET /api/tasks ─────────────────────────────────────────────────────────

/**
 * Returns all tasks ordered by creation date (newest first).
 */
export async function GET() {
  const tasks = await db.task.findMany({
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
 *   title        string   (required)
 *   description  string   (optional)
 *   status       TaskStatus   (optional, default: not_started)
 *   priority     TaskPriority (optional, default: medium)
 *   dueDate      ISO date string (optional)
 *   assigneeIds  string[]  (optional, up to 5 user IDs)
 */
export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

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
  } = (body ?? {}) as Record<string, unknown>;

  // ── Validate ──────────────────────────────────────────────────────────────
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
    }
  }

  const ids: string[] = [];
  if (assigneeIds !== undefined && assigneeIds !== null) {
    if (!Array.isArray(assigneeIds)) {
      errors.assigneeIds = ["assigneeIds must be an array of user IDs."];
    } else if (assigneeIds.length > 5) {
      errors.assigneeIds = ["Maximum 5 assignees allowed."];
    } else {
      ids.push(...(assigneeIds as string[]));
    }
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Verify assignees exist ─────────────────────────────────────────────────
  if (ids.length > 0) {
    const found = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) {
      return fail("One or more assignees not found.", 404);
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────
  const task = await db.task.create({
    data: {
      title: (title as string).trim(),
      ...(description !== undefined && { description: (description as string).trim() || null }),
      ...(status !== undefined && { status: status as TaskStatus }),
      ...(priority !== undefined && { priority: priority as TaskPriority }),
      ...(parsedDueDate !== undefined && { dueDate: parsedDueDate }),
      ...(ids.length > 0 && {
        assignees: {
          create: ids.map((userId) => ({ userId })),
        },
      }),
    },
    select: TASK_SELECT,
  });

  return ok("Task created successfully.", { task: serializeTask(task) }, 201);
}
