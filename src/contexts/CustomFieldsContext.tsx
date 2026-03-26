"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ColumnConfig, CustomFieldDef, SYSTEM_COLUMNS } from "@/types";

interface CustomFieldsCtx {
  allFields: CustomFieldDef[];
  taskFields: CustomFieldDef[];
  userFields: CustomFieldDef[];
  /** Merged, ordered list of all visible+hidden columns for the task list view. */
  columnOrder: ColumnConfig[];
  /** Call after any create / edit / delete to immediately sync fields. */
  refresh: () => Promise<void>;
  /** Call after saving column order to immediately sync the layout. */
  refreshColumns: () => Promise<void>;
}

const CustomFieldsContext = createContext<CustomFieldsCtx>({
  allFields: [],
  taskFields: [],
  userFields: [],
  columnOrder: [],
  refresh: async () => {},
  refreshColumns: async () => {},
});

// ── Merge helper ───────────────────────────────────────────────────────────
// Combines DB-saved column order with the current set of task fields,
// filling in any gaps (new fields added after the last save, system columns
// never explicitly saved) so the list is always complete.

function buildColumnOrder(
  saved: { columnKey: string; order: number; visible: boolean }[],
  taskFields: CustomFieldDef[]
): ColumnConfig[] {
  const listableCustomFields = taskFields.filter((f) => f.showInListView);
  const validCustomKeys = new Set(listableCustomFields.map((f) => `cf_${f.id}`));
  const validSystemKeys = new Set(SYSTEM_COLUMNS.map((c) => c.columnKey));

  // Drop stale saved entries (fields that were deleted)
  const validSaved = saved.filter(
    (s) => validSystemKeys.has(s.columnKey) || validCustomKeys.has(s.columnKey)
  );
  const savedKeys = new Set(validSaved.map((s) => s.columnKey));

  let nextOrder =
    validSaved.length > 0 ? Math.max(...validSaved.map((s) => s.order)) + 1 : 0;

  const labelFor = (key: string): string => {
    const sys = SYSTEM_COLUMNS.find((c) => c.columnKey === key);
    if (sys) return sys.label;
    const fieldId = key.startsWith("cf_") ? key.slice(3) : null;
    return taskFields.find((f) => f.id === fieldId)?.label ?? key;
  };

  const result: ColumnConfig[] = validSaved.map((s) => ({
    columnKey: s.columnKey,
    label: labelFor(s.columnKey),
    order: s.order,
    visible: s.visible,
  }));

  // Append any system column not yet saved
  for (const col of SYSTEM_COLUMNS) {
    if (!savedKeys.has(col.columnKey)) {
      result.push({ ...col, order: nextOrder++ });
    }
  }

  // Append any new listable custom field not yet saved
  for (const field of listableCustomFields) {
    const key = `cf_${field.id}`;
    if (!savedKeys.has(key)) {
      result.push({ columnKey: key, label: field.label, order: nextOrder++, visible: true });
    }
  }

  return result.sort((a, b) => a.order - b.order);
}

// ── Provider ───────────────────────────────────────────────────────────────

export function CustomFieldsProvider({ children }: { children: React.ReactNode }) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [savedColumns, setSavedColumns] = useState<
    { columnKey: string; order: number; visible: boolean }[]
  >([]);

  const loadFields = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-fields");
      if (!res.ok) return;
      const data = await res.json();
      if (data.data?.fields) setFields(data.data.fields as CustomFieldDef[]);
    } catch {
      // silent — non-critical background poll
    }
  }, []);

  const loadColumns = useCallback(async () => {
    try {
      const res = await fetch("/api/task-list-columns");
      if (!res.ok) return;
      const data = await res.json();
      if (data.data?.columns) setSavedColumns(data.data.columns);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadFields();
    loadColumns();
    const id = setInterval(() => {
      loadFields();
      loadColumns();
    }, 30_000);
    return () => clearInterval(id);
  }, [loadFields, loadColumns]);

  const taskFields = fields.filter((f) => f.entity === "task");

  return (
    <CustomFieldsContext.Provider
      value={{
        allFields: fields,
        taskFields,
        userFields: fields.filter((f) => f.entity === "user"),
        columnOrder: buildColumnOrder(savedColumns, taskFields),
        refresh: loadFields,
        refreshColumns: loadColumns,
      }}
    >
      {children}
    </CustomFieldsContext.Provider>
  );
}

export function useCustomFields() {
  return useContext(CustomFieldsContext);
}
