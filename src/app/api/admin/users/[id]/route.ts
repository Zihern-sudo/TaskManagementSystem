import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { Role } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/users/[id] ────────────────────────────────────────────

/**
 * Update a user's full name and/or role.
 *
 * Body: { fullName?: string; role?: "admin" | "member" }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { fullName, role } = (body ?? {}) as Record<string, unknown>;

  // At least one field must be provided
  if (fullName === undefined && role === undefined) {
    return fail("Provide at least one field to update: fullName or role.");
  }

  const errors: Record<string, string[]> = {};

  if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim())) {
    errors.fullName = ["Full name must be a non-empty string."];
  }

  if (role !== undefined && role !== "admin" && role !== "member") {
    errors.role = ["Role must be either 'admin' or 'member'."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Existence check ───────────────────────────────────────────────────────
  const existing = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return fail("User not found.", 404);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  const updated = await db.user.update({
    where: { id },
    data: {
      ...(fullName !== undefined && { fullName: (fullName as string).trim() }),
      ...(role !== undefined && { role: role as Role }),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return ok("User updated successfully.", { user: updated });
}

// ── DELETE /api/admin/users/[id] ───────────────────────────────────────────

/**
 * Delete a user.
 * An admin cannot delete their own account.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  // ── Guard: cannot delete self ─────────────────────────────────────────────
  const caller = getRequestUser(req);
  if (caller?.id === id) {
    return fail("You cannot delete your own account.", 403);
  }

  // ── Existence check ───────────────────────────────────────────────────────
  const existing = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return fail("User not found.", 404);
  }

  await db.user.delete({ where: { id } });

  return ok("User deleted successfully.");
}
