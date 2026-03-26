import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { FieldType } from "@prisma/client";

const MODAL_LAYOUT_KEY = "task_modal_layout";
const LIST_LAYOUT_KEY = "task_list_layout";

async function removeFieldFromLayout(key: string, fieldId: string): Promise<void> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  if (!setting) return;
  try {
    const parsed = JSON.parse(setting.value);
    if (!Array.isArray(parsed)) return;
    const updated = (parsed as string[]).filter((id) => id !== fieldId);
    await db.appSetting.update({ where: { key }, data: { value: JSON.stringify(updated) } });
  } catch {
    // ignore
  }
}

type RouteContext = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/custom-fields/[id] ────────────────────────────────────

/**
 * Updates a custom field definition. Admin only.
 *
 * Always mutable : label, required, showInListView, order
 * Now mutable    : fieldKey (with uniqueness check), type (with value migration),
 *                  options (add / rename / remove — with value migration)
 * Still immutable: entity (task ↔ user requires moving rows between tables)
 *
 * Body:
 *   label?          string
 *   fieldKey?       string   — must match /^[a-z][a-z0-9_]*$/, globally unique
 *   type?           "text" | "picklist"
 *   options?        string[] — final ordered list of picklist options
 *   renames?        Record<string, string>  — { "old option": "new option" }
 *   required?       boolean
 *   showInListView? boolean
 *   order?          number
 *
 * Migrations run inside a single transaction:
 *   - text → picklist : delete values not in the new options list
 *   - picklist → text : no value changes (existing values become free text)
 *   - renames         : updateMany values matching each old key → new value
 *   - removed options : deleteMany values matching removed option strings
 *
 * Response includes valuesCleared and valuesMigrated for toast feedback.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can manage custom fields.", 403);

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

  const existing = await db.customField.findUnique({ where: { id } });
  if (!existing) return fail("Custom field not found.", 404);

  const errors: Record<string, string[]> = {};

  // ── Validate label ────────────────────────────────────────────────────────
  if ("label" in data) {
    if (typeof data.label !== "string" || !(data.label as string).trim()) {
      errors.label = ["Label must be a non-empty string."];
    }
  }

  // ── Validate fieldKey ─────────────────────────────────────────────────────
  if ("fieldKey" in data) {
    const fk = data.fieldKey as string;
    if (!fk || !fk.trim()) {
      errors.fieldKey = ["Field key is required."];
    } else if (!/^[a-z][a-z0-9_]*$/.test(fk.trim())) {
      errors.fieldKey = ["Must start with a letter; only lowercase letters, numbers, underscores."];
    } else if (fk.trim() !== existing.fieldKey) {
      const conflict = await db.customField.findUnique({ where: { fieldKey: fk.trim() } });
      if (conflict) errors.fieldKey = [`Field key "${fk.trim()}" is already in use.`];
    }
  }

  // ── Validate type ─────────────────────────────────────────────────────────
  const newType = "type" in data ? (data.type as FieldType) : undefined;
  if (newType !== undefined && newType !== "text" && newType !== "picklist") {
    errors.type = ["Type must be 'text' or 'picklist'."];
  }

  // ── Validate options ──────────────────────────────────────────────────────
  const effectiveType = newType ?? existing.type;
  if (effectiveType === "picklist") {
    if ("options" in data) {
      if (!Array.isArray(data.options) || (data.options as unknown[]).length === 0) {
        errors.options = ["Picklist fields require at least one option."];
      } else if ((data.options as unknown[]).some((o) => typeof o !== "string" || !(o as string).trim())) {
        errors.options = ["All options must be non-empty strings."];
      }
    } else if (newType === "picklist" && existing.type !== "picklist") {
      // Switching to picklist but no options provided
      errors.options = ["Picklist fields require at least one option."];
    }
  }

  if ("order" in data && typeof data.order !== "number") {
    errors.order = ["Order must be a number."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  // ── Build scalar update payload ───────────────────────────────────────────
  const updateData: Record<string, unknown> = {};
  if ("label" in data) updateData.label = (data.label as string).trim();
  if ("fieldKey" in data) updateData.fieldKey = (data.fieldKey as string).trim();
  if ("type" in data) updateData.type = newType;
  if ("required" in data) updateData.required = data.required === true;
  if ("showInListView" in data) updateData.showInListView = data.showInListView === true;
  if ("order" in data) updateData.order = data.order as number;
  if ("options" in data && effectiveType === "picklist") {
    updateData.options = (data.options as string[]).map((o) => (o as string).trim());
  }
  if (newType === "text") {
    // Switching to text — clear the options array
    updateData.options = [];
  }

  // ── Renames map ────────────────────────────────────────────────────────────
  const renames = (
    typeof data.renames === "object" && data.renames !== null ? data.renames : {}
  ) as Record<string, string>;

  // ── Run migrations + update inside a transaction ──────────────────────────
  let valuesCleared = 0;
  let valuesMigrated = 0;
  const isTask = existing.entity === "task";
  const newOptions = "options" in data ? (data.options as string[]).map((o) => (o as string).trim()) : null;

  await db.$transaction(async (tx) => {
    // 1. text → picklist: delete values not in the new options list
    if (newType === "picklist" && existing.type === "text" && newOptions) {
      if (isTask) {
        const r = await tx.taskCustomFieldValue.deleteMany({
          where: { fieldId: id, value: { notIn: newOptions } },
        });
        valuesCleared += r.count;
      } else {
        const r = await tx.userCustomFieldValue.deleteMany({
          where: { fieldId: id, value: { notIn: newOptions } },
        });
        valuesCleared += r.count;
      }
    }

    // 2. Apply renames (picklist staying picklist, or picklist → text doesn't need this)
    if (existing.type === "picklist" && newType !== "text" && Object.keys(renames).length > 0) {
      for (const [oldVal, newVal] of Object.entries(renames)) {
        if (!oldVal || !newVal || oldVal === newVal) continue;
        if (isTask) {
          const r = await tx.taskCustomFieldValue.updateMany({
            where: { fieldId: id, value: oldVal },
            data: { value: newVal },
          });
          valuesMigrated += r.count;
        } else {
          const r = await tx.userCustomFieldValue.updateMany({
            where: { fieldId: id, value: oldVal },
            data: { value: newVal },
          });
          valuesMigrated += r.count;
        }
      }
    }

    // 3. Removed options: options in existing that are not in newOptions and not a rename source
    if (existing.type === "picklist" && newType !== "text" && newOptions) {
      const removedOptions = existing.options.filter(
        (o) => !Object.keys(renames).includes(o) && !newOptions.includes(o)
      );
      if (removedOptions.length > 0) {
        if (isTask) {
          const r = await tx.taskCustomFieldValue.deleteMany({
            where: { fieldId: id, value: { in: removedOptions } },
          });
          valuesCleared += r.count;
        } else {
          const r = await tx.userCustomFieldValue.deleteMany({
            where: { fieldId: id, value: { in: removedOptions } },
          });
          valuesCleared += r.count;
        }
      }
    }

    // 4. picklist → text: no value changes needed, values become free text

    // 5. Update the field definition
    await tx.customField.update({ where: { id }, data: updateData });
  });

  const updatedField = await db.customField.findUnique({ where: { id } });
  return ok("Custom field updated successfully.", { field: updatedField, valuesCleared, valuesMigrated });
}

// ── DELETE /api/admin/custom-fields/[id] ───────────────────────────────────

/**
 * Deletes a custom field and all its task/user values (cascade). Admin only.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can manage custom fields.", 403);

  const existing = await db.customField.findUnique({ where: { id } });
  if (!existing) return fail("Custom field not found.", 404);

  await db.customField.delete({ where: { id } });

  // Remove field from both layout settings
  await removeFieldFromLayout(MODAL_LAYOUT_KEY, id);
  await removeFieldFromLayout(LIST_LAYOUT_KEY, id);

  return ok("Custom field and all its values deleted successfully.");
}
