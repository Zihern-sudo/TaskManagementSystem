import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { FieldType } from "@prisma/client";

const VALID_FIELD_TYPES = Object.values(FieldType);

// ── GET /api/admin/custom-fields ───────────────────────────────────────────

/**
 * Returns all defined custom fields ordered by display order.
 * Accessible to all authenticated users so TaskModal can render the fields.
 */
export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const fields = await db.customField.findMany({
    orderBy: { order: "asc" },
  });

  return ok("Custom fields retrieved successfully.", { fields });
}

// ── POST /api/admin/custom-fields ──────────────────────────────────────────

/**
 * Creates a new custom field definition. Admin only.
 *
 * Body:
 *   label     string   (required)
 *   fieldKey  string   (required) — unique slug: lowercase letters, numbers, underscores
 *   type      FieldType (required) — "text" | "picklist"
 *   options   string[] (required when type = "picklist")
 *   required  boolean  (optional, default: false)
 *   order     number   (optional, auto-appended to end if omitted)
 */
export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can manage custom fields.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { label, fieldKey, type, options, required, order } = (body ?? {}) as Record<string, unknown>;

  const errors: Record<string, string[]> = {};

  if (typeof label !== "string" || !label.trim()) {
    errors.label = ["Label is required."];
  }

  if (typeof fieldKey !== "string" || !fieldKey.trim()) {
    errors.fieldKey = ["Field key is required."];
  } else if (!/^[a-z][a-z0-9_]*$/.test(fieldKey)) {
    errors.fieldKey = ["Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores."];
  }

  if (!VALID_FIELD_TYPES.includes(type as FieldType)) {
    errors.type = [`Type must be one of: ${VALID_FIELD_TYPES.join(", ")}.`];
  }

  if (type === "picklist") {
    if (!Array.isArray(options) || (options as unknown[]).length === 0) {
      errors.options = ["Picklist fields require at least one option."];
    } else if ((options as unknown[]).some((o) => typeof o !== "string" || !(o as string).trim())) {
      errors.options = ["All options must be non-empty strings."];
    }
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // Duplicate key check
  const existing = await db.customField.findUnique({ where: { fieldKey: fieldKey as string } });
  if (existing) {
    return fail("Validation failed.", 422, { fieldKey: ["A field with this key already exists."] });
  }

  // Auto-compute order (append to end)
  const maxOrder = await db.customField.aggregate({ _max: { order: true } });
  const nextOrder = typeof order === "number" ? order : (maxOrder._max.order ?? -1) + 1;

  const field = await db.customField.create({
    data: {
      label: (label as string).trim(),
      fieldKey: fieldKey as string,
      type: type as FieldType,
      options: type === "picklist" ? (options as string[]).map((o) => (o as string).trim()) : [],
      required: required === true,
      order: nextOrder,
    },
  });

  return ok("Custom field created successfully.", { field }, 201);
}
