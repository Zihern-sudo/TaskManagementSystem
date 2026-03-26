import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

/**
 * Stable IDs for built-in system fields.
 * These are used as layout identifiers alongside custom field UUIDs.
 */
export const MODAL_SYSTEM_FIELDS = ["status", "priority", "due_date", "assignees", "created_at"] as const;
export const LIST_SYSTEM_FIELDS = ["status", "priority", "assignees", "due_date", "created_at"] as const;

const MODAL_LAYOUT_KEY = "task_modal_layout";
const LIST_LAYOUT_KEY = "task_list_layout";

/**
 * Merges a stored layout with the current set of field IDs.
 * - Keeps stored order for IDs that still exist.
 * - Appends any new IDs not present in the stored layout.
 * - Drops IDs from the stored layout that no longer exist.
 */
function mergeLayout(stored: string[], current: string[]): string[] {
  const currentSet = new Set(current);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of stored) {
    if (currentSet.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  for (const id of current) {
    if (!seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  return result;
}

async function getStoredLayout(key: string): Promise<string[]> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  if (!setting) return [];
  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── GET /api/admin/settings/field-layout ────────────────────────────────────

/**
 * Returns the current field layout for the modal right panel and list view.
 * Merges stored layout with current custom fields so any new fields are appended.
 * Accessible to all authenticated users.
 *
 * Response:
 *   modalLayout  string[]  — ordered field IDs for TaskModal right panel
 *   listLayout   string[]  — ordered field IDs for TaskBoard list view columns
 */
export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const [taskCustomFields, modalStored, listStored] = await Promise.all([
    db.customField.findMany({ where: { entity: "task" }, orderBy: { order: "asc" }, select: { id: true } }),
    getStoredLayout(MODAL_LAYOUT_KEY),
    getStoredLayout(LIST_LAYOUT_KEY),
  ]);

  const customFieldIds = taskCustomFields.map((f) => f.id);

  const modalLayout = mergeLayout(modalStored, [...MODAL_SYSTEM_FIELDS, ...customFieldIds]);
  const listLayout = mergeLayout(listStored, [...LIST_SYSTEM_FIELDS, ...customFieldIds]);

  return ok("Field layout retrieved successfully.", { modalLayout, listLayout });
}

// ── PATCH /api/admin/settings/field-layout ──────────────────────────────────

/**
 * Saves a new field layout. Admin only.
 *
 * Body:
 *   modalLayout?  string[]  — new ordered field IDs for TaskModal right panel
 *   listLayout?   string[]  — new ordered field IDs for TaskBoard list view
 */
export async function PATCH(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can update field layout.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const data = (body ?? {}) as Record<string, unknown>;

  if (!("modalLayout" in data) && !("listLayout" in data)) {
    return fail("Provide modalLayout or listLayout.");
  }

  const ops: Promise<unknown>[] = [];

  if ("modalLayout" in data) {
    if (!Array.isArray(data.modalLayout) || (data.modalLayout as unknown[]).some((id) => typeof id !== "string")) {
      return fail("modalLayout must be an array of strings.");
    }
    ops.push(
      db.appSetting.upsert({
        where: { key: MODAL_LAYOUT_KEY },
        update: { value: JSON.stringify(data.modalLayout) },
        create: { key: MODAL_LAYOUT_KEY, value: JSON.stringify(data.modalLayout) },
      })
    );
  }

  if ("listLayout" in data) {
    if (!Array.isArray(data.listLayout) || (data.listLayout as unknown[]).some((id) => typeof id !== "string")) {
      return fail("listLayout must be an array of strings.");
    }
    ops.push(
      db.appSetting.upsert({
        where: { key: LIST_LAYOUT_KEY },
        update: { value: JSON.stringify(data.listLayout) },
        create: { key: LIST_LAYOUT_KEY, value: JSON.stringify(data.listLayout) },
      })
    );
  }

  await Promise.all(ops);

  return ok("Field layout updated successfully.");
}
