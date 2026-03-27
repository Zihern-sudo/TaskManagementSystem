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
export const USER_LIST_SYSTEM_FIELDS = ["role", "status", "created_at"] as const;
export const USER_FORM_SYSTEM_FIELDS = ["full_name", "email", "role"] as const;
/** Fields available in the Create Task form (no created_at — set by server) */
export const TASK_FORM_SYSTEM_FIELDS = ["title", "description", "status", "priority", "due_date", "assignees"] as const;

/** Build a per-user AppSetting key. */
function userKey(userId: string, surface: "task_modal" | "task_list" | "user_list" | "user_form" | "task_form"): string {
  return `user_layout:${userId}:${surface}`;
}

/**
 * Merges a stored layout with the current set of field IDs.
 * - Keeps stored order for IDs that still exist.
 * - Appends any new IDs not present in the stored layout.
 * - Drops IDs from the stored layout that no longer exist.
 */
export function mergeLayout(stored: string[], current: string[]): string[] {
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
 * Returns the calling user's personal field layout for all surfaces.
 * Merges stored layout with current custom fields so new fields are appended.
 * Accessible to all authenticated users.
 *
 * Response:
 *   modalLayout    string[]  — ordered field IDs for TaskModal right panel
 *   listLayout     string[]  — ordered field IDs for TaskBoard list view columns
 *   userListLayout string[]  — ordered field IDs for User Management table columns
 */
export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const [taskCustomFields, userCustomFields, modalStored, listStored, userListStored, userFormStored, taskFormStored] = await Promise.all([
    db.customField.findMany({ where: { entity: "task" }, orderBy: { order: "asc" }, select: { id: true } }),
    db.customField.findMany({ where: { entity: "user" }, orderBy: { order: "asc" }, select: { id: true } }),
    getStoredLayout(userKey(caller.id, "task_modal")),
    getStoredLayout(userKey(caller.id, "task_list")),
    getStoredLayout(userKey(caller.id, "user_list")),
    getStoredLayout(userKey(caller.id, "user_form")),
    getStoredLayout(userKey(caller.id, "task_form")),
  ]);

  const taskCFIds = taskCustomFields.map((f) => f.id);
  const userCFIds = userCustomFields.map((f) => f.id);

  const modalLayout = mergeLayout(modalStored, [...MODAL_SYSTEM_FIELDS, ...taskCFIds]);
  const listLayout = mergeLayout(listStored, [...LIST_SYSTEM_FIELDS, ...taskCFIds]);
  const userListLayout = mergeLayout(userListStored, [...USER_LIST_SYSTEM_FIELDS, ...userCFIds]);
  const userFormLayout = mergeLayout(userFormStored, [...USER_FORM_SYSTEM_FIELDS, ...userCFIds]);
  const taskFormLayout = mergeLayout(taskFormStored, [...TASK_FORM_SYSTEM_FIELDS, ...taskCFIds]);

  return ok("Field layout retrieved successfully.", { modalLayout, listLayout, userListLayout, userFormLayout, taskFormLayout });
}

// ── PATCH /api/admin/settings/field-layout ──────────────────────────────────

/**
 * Saves the calling user's personal field layout. Any authenticated user can
 * update their own layout.
 *
 * Body:
 *   modalLayout?    string[]  — new ordered field IDs for TaskModal right panel
 *   listLayout?     string[]  — new ordered field IDs for TaskBoard list view
 *   userListLayout? string[]  — new ordered field IDs for User Management table
 */
export async function PATCH(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const data = (body ?? {}) as Record<string, unknown>;

  if (!("modalLayout" in data) && !("listLayout" in data) && !("userListLayout" in data) && !("userFormLayout" in data) && !("taskFormLayout" in data)) {
    return fail("Provide modalLayout, listLayout, userListLayout, userFormLayout, or taskFormLayout.");
  }

  const ops: Promise<unknown>[] = [];

  function queueLayout(field: string, surface: "task_modal" | "task_list" | "user_list" | "user_form" | "task_form") {
    const value = data[field];
    if (!(field in data)) return;
    if (!Array.isArray(value) || (value as unknown[]).some((id) => typeof id !== "string")) {
      throw new Error(`${field} must be an array of strings.`);
    }
    const key = userKey(caller!.id, surface);
    ops.push(
      db.appSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      })
    );
  }

  try {
    queueLayout("modalLayout", "task_modal");
    queueLayout("listLayout", "task_list");
    queueLayout("userListLayout", "user_list");
    queueLayout("userFormLayout", "user_form");
    queueLayout("taskFormLayout", "task_form");
  } catch (e) {
    return fail((e as Error).message);
  }

  await Promise.all(ops);

  return ok("Field layout updated successfully.");
}
