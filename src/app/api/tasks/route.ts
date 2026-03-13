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
  assignedUser: {
    select: { id: true, fullName: true, email: true },
  },
  createdAt: true,
  updatedAt: true,
} as const;

// ── GET /api/tasks ─────────────────────────────────────────────────────────

/**
 * Returns all tasks ordered by creation date (newest first).
 */
export async function GET() {
  const tasks = await db.task.findMany({
    select: TASK_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return ok("Tasks retrieved successfully.", { tasks });
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
 *   assignedUserId string (optional)
 */
export async function POST(req: NextRequest) {
  // Middleware guarantees a valid session; this is a safety read.
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
    assignedUserId,
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

  if (assignedUserId !== undefined && assignedUserId !== null && typeof assignedUserId !== "string") {
    errors.assignedUserId = ["assignedUserId must be a string."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Verify assigned user exists ───────────────────────────────────────────
  if (assignedUserId) {
    const userExists = await db.user.findUnique({
      where: { id: assignedUserId as string },
      select: { id: true },
    });
    if (!userExists) {
      return fail("Assigned user not found.", 404);
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
      ...(assignedUserId !== undefined && { assignedUserId: assignedUserId as string || null }),
    },
    select: TASK_SELECT,
  });

  return ok("Task created successfully.", { task }, 201);
}
