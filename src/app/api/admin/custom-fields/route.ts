import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { FieldType, FieldEntity } from "@prisma/client";
import { MODAL_SYSTEM_FIELDS, LIST_SYSTEM_FIELDS, USER_FORM_SYSTEM_FIELDS } from "@/app/api/settings/field-layout/route";

const VALID_FIELD_TYPES = Object.values(FieldType);
const VALID_ENTITIES = Object.values(FieldEntity);

function userLayoutKey(userId: string, surface: "task_modal" | "task_list" | "user_form"): string {
  return `user_layout:${userId}:${surface}`;
}

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
 *   label          string      (required)
 *   fieldKey       string      (required) — unique slug: lowercase letters, numbers, underscores
 *   type           FieldType   (required) — "text" | "picklist"
 *   entity         FieldEntity (optional, default: "task") — "task" | "user"
 *   showInListView boolean     (optional, default: false)
 *   options        string[]    (required when type = "picklist")
 *   required       boolean     (optional, default: false)
 *   order          number      (optional, auto-appended to end if omitted)
 *   insertAfter    string      (optional) — field ID (system or custom) to insert after in layouts
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

  const { label, fieldKey, type, entity, showInListView, options, required, order, insertAfter } = (body ?? {}) as Record<string, unknown>;

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

  if (entity !== undefined && !VALID_ENTITIES.includes(entity as FieldEntity)) {
    errors.entity = [`Entity must be one of: ${VALID_ENTITIES.join(", ")}.`];
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
      entity: VALID_ENTITIES.includes(entity as FieldEntity) ? (entity as FieldEntity) : "task",
      showInListView: showInListView === true,
      options: type === "picklist" ? (options as string[]).map((o) => (o as string).trim()) : [],
      required: required === true,
      order: nextOrder,
    },
  });

  // ── Update the creating admin's personal layout with the chosen position ──
  const insertAfterId = typeof insertAfter === "string" ? insertAfter : null;
  if (field.entity === "task") {
    const modalKey = userLayoutKey(caller.id, "task_modal");
    const listKey = userLayoutKey(caller.id, "task_list");
    await updateLayoutWithNewField(modalKey, [...MODAL_SYSTEM_FIELDS], field.id, insertAfterId);
    await updateLayoutWithNewField(listKey, [...LIST_SYSTEM_FIELDS], field.id, insertAfterId);
  } else if (field.entity === "user") {
    const formKey = userLayoutKey(caller.id, "user_form");
    await updateLayoutWithNewField(formKey, [...USER_FORM_SYSTEM_FIELDS], field.id, insertAfterId);
  }

  return ok("Custom field created successfully.", { field }, 201);
}

/**
 * Reads a layout from AppSetting, inserts the new field ID after `insertAfterId`
 * (or appends to end if not found), and saves back.
 */
async function updateLayoutWithNewField(
  key: string,
  systemFields: string[],
  newFieldId: string,
  insertAfterId: string | null
): Promise<void> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  let layout: string[] = [];

  if (setting) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) layout = parsed;
    } catch {
      // ignore, start fresh
    }
  }

  // If layout is empty, seed with system fields
  if (layout.length === 0) {
    layout = [...systemFields];
  }

  // Remove the new field if somehow already present
  layout = layout.filter((id) => id !== newFieldId);

  if (insertAfterId && layout.includes(insertAfterId)) {
    const idx = layout.indexOf(insertAfterId);
    layout.splice(idx + 1, 0, newFieldId);
  } else {
    // Append at end
    layout.push(newFieldId);
  }

  await db.appSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(layout) },
    create: { key, value: JSON.stringify(layout) },
  });
}
