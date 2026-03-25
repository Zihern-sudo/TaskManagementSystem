import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import bcrypt from "bcryptjs";

// ── GET /api/profile ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const user = await db.user.findUnique({
    where: { id: caller.id },
    select: { id: true, fullName: true, email: true, role: true, status: true, avatarUrl: true, createdAt: true, password: true, hasSetPassword: true },
  });
  if (!user) return fail("User not found.", 404);

  // Task summary
  const [total, inProgress, overdue] = await Promise.all([
    db.taskAssignee.count({ where: { userId: caller.id } }),
    db.taskAssignee.count({
      where: { userId: caller.id, task: { status: "in_progress" } },
    }),
    db.taskAssignee.count({
      where: {
        userId: caller.id,
        task: {
          dueDate: { lt: new Date() },
          status: { notIn: ["completed"] },
        },
      },
    }),
  ]);

  const { password: _pw, hasSetPassword: _hsp, ...userWithoutPassword } = user;

  return ok("Profile retrieved.", {
    user: {
      ...userWithoutPassword,
      hasPassword: user.hasSetPassword,
      createdAt: user.createdAt.toISOString(),
    },
    taskSummary: { total, inProgress, overdue },
  });
}

// ── PATCH /api/profile ─────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON."); }

  const { fullName, currentPassword, newPassword } = (body ?? {}) as Record<string, unknown>;

  const errors: Record<string, string[]> = {};

  if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim())) {
    errors.fullName = ["Full name must be a non-empty string."];
  }

  if (newPassword !== undefined) {
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      errors.newPassword = ["New password must be at least 8 characters."];
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      errors.currentPassword = ["Current password is required to set a new password."];
    }
  }

  if (Object.keys(errors).length > 0) return fail("Validation failed.", 422, errors);

  const user = await db.user.findUnique({
    where: { id: caller.id },
    select: { id: true, fullName: true, email: true, password: true, hasSetPassword: true, role: true, status: true, createdAt: true },
  });
  if (!user) return fail("User not found.", 404);

  // Verify current password before changing
  if (newPassword) {
    if (!user.hasSetPassword || !user.password) {
      return fail("No password is set on this account. Use the 'Set a Password' option instead.", 400);
    }
    const valid = await bcrypt.compare(currentPassword as string, user.password);
    if (!valid) return fail("Current password is incorrect.", 400);
  }

  const updateData: Record<string, unknown> = {};
  if (fullName) updateData.fullName = (fullName as string).trim();
  if (newPassword) {
    updateData.password = await bcrypt.hash(newPassword as string, 12);
    updateData.hasSetPassword = true;
  }

  const updated = await db.user.update({
    where: { id: caller.id },
    data: updateData,
    select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true },
  });

  return ok("Profile updated.", {
    user: { ...updated, createdAt: updated.createdAt.toISOString() },
  });
}
