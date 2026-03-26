import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { VALID_STATUSES } from "@/app/api/tasks/route";
import { TaskStatus } from "@prisma/client";
import { syncParentStatus } from "@/app/api/tasks/[id]/route";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/tasks/[id]/status
 *
 * Updates only the status field of a task.
 * Designed for the Kanban drag-and-drop interaction.
 *
 * Body: { status: TaskStatus }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { status } = (body ?? {}) as Record<string, unknown>;

  if (!status) {
    return fail("status is required.");
  }

  if (!VALID_STATUSES.includes(status as TaskStatus)) {
    return fail(`status must be one of: ${VALID_STATUSES.join(", ")}.`, 422);
  }

  const existing = await db.task.findUnique({ where: { id }, select: { id: true, parentId: true } });
  if (!existing) return fail("Task not found.", 404);

  const task = await db.task.update({
    where: { id },
    data: { status: status as TaskStatus },
    select: { id: true, status: true, updatedAt: true },
  });

  // Sync parent task status when a subtask's status changes
  if (existing.parentId) {
    await syncParentStatus(existing.parentId);
  }

  return ok("Task status updated successfully.", { task });
}
