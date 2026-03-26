import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { Role } from "@prisma/client";

// ── Shared select shape ────────────────────────────────────────────────────

export const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
  customFieldValues: {
    select: {
      field: { select: { id: true, label: true, fieldKey: true, type: true, order: true } },
      value: true,
    },
  },
} as const;

// Flatten user custom field values to a clean shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeUser(user: any) {
  const { customFieldValues, ...rest } = user;
  return {
    ...rest,
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
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

// ── GET /api/admin/users ───────────────────────────────────────────────────

/**
 * Returns all users ordered by creation date (newest first).
 * Includes user-entity custom field values.
 */
export async function GET() {
  const users = await db.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return ok("Users retrieved successfully.", { users: users.map(serializeUser) });
}

// ── POST /api/admin/users ──────────────────────────────────────────────────

/**
 * Creates a new user with status "pending".
 *
 * Body: { fullName: string; email: string; role: "admin" | "member" }
 *
 * The new user has no usable password — a random placeholder hash is stored
 * so the DB constraint is satisfied. They must accept an invite to set one.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const errors: Record<string, string[]> = {};

  const { fullName, email, role } = (body ?? {}) as Record<string, unknown>;

  if (typeof fullName !== "string" || !fullName.trim()) {
    errors.fullName = ["Full name is required."];
  }

  if (typeof email !== "string" || !email.trim()) {
    errors.email = ["Email is required."];
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = ["Email must be a valid email address."];
  }

  if (role !== "admin" && role !== "member") {
    errors.role = ["Role must be either 'admin' or 'member'."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  const normalizedEmail = (email as string).toLowerCase().trim();

  // ── Check uniqueness ─────────────────────────────────────────────────────
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return fail("A user with this email already exists.", 409);
  }

  // ── Create user with no password ─────────────────────────────────────────
  // Password is left null — the login route handles null passwords safely via
  // a dummy hash comparison. Users gain a real password by accepting an invite
  // or (for Google SSO users) via the "Set a password" flow in their profile.
  const user = await db.user.create({
    data: {
      fullName: (fullName as string).trim(),
      email: normalizedEmail,
      role: role as Role,
      status: "pending",
    },
    select: USER_SELECT,
  });

  return ok("User created successfully.", { user: serializeUser(user) }, 201);
}
