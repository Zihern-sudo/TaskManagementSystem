"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CustomFieldDef } from "@/types";

interface CustomFieldsCtx {
  allFields: CustomFieldDef[];
  taskFields: CustomFieldDef[];
  userFields: CustomFieldDef[];
  /** Call after any create / edit / delete to immediately sync the context. */
  refresh: () => Promise<void>;
}

const CustomFieldsContext = createContext<CustomFieldsCtx>({
  allFields: [],
  taskFields: [],
  userFields: [],
  refresh: async () => {},
});

export function CustomFieldsProvider({ children }: { children: React.ReactNode }) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-fields");
      if (!res.ok) return;
      const data = await res.json();
      if (data.data?.fields) setFields(data.data.fields as CustomFieldDef[]);
    } catch {
      // silent — non-critical background poll
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 30 s so all browser sessions pick up changes in real-time
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <CustomFieldsContext.Provider
      value={{
        allFields: fields,
        taskFields: fields.filter((f) => f.entity === "task"),
        userFields: fields.filter((f) => f.entity === "user"),
        refresh: load,
      }}
    >
      {children}
    </CustomFieldsContext.Provider>
  );
}

export function useCustomFields() {
  return useContext(CustomFieldsContext);
}
