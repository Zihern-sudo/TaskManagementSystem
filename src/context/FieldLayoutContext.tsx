"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";

export interface FieldLayoutContextValue {
  modalLayout: string[];
  listLayout: string[];
  /** Re-fetches layouts from the server — call after creating/deleting custom fields */
  refresh: () => Promise<void>;
  /** Saves a new modal layout and refreshes */
  saveModalLayout: (layout: string[]) => Promise<void>;
  /** Saves a new list layout and refreshes */
  saveListLayout: (layout: string[]) => Promise<void>;
}

const FieldLayoutContext = createContext<FieldLayoutContextValue>({
  modalLayout: [],
  listLayout: [],
  refresh: async () => {},
  saveModalLayout: async () => {},
  saveListLayout: async () => {},
});

export function FieldLayoutProvider({ children }: { children: React.ReactNode }) {
  const [modalLayout, setModalLayout] = useState<string[]>([]);
  const [listLayout, setListLayout] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/field-layout");
      if (res.ok) {
        const json = await res.json();
        setModalLayout(json.data?.modalLayout ?? []);
        setListLayout(json.data?.listLayout ?? []);
      }
    } catch {
      // silently ignore; layouts will be empty arrays and fields render in default order
    }
  }, []);

  const saveModalLayout = useCallback(async (layout: string[]) => {
    await fetch("/api/admin/settings/field-layout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalLayout: layout }),
    });
    setModalLayout(layout);
  }, []);

  const saveListLayout = useCallback(async (layout: string[]) => {
    await fetch("/api/admin/settings/field-layout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listLayout: layout }),
    });
    setListLayout(layout);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FieldLayoutContext.Provider value={{ modalLayout, listLayout, refresh, saveModalLayout, saveListLayout }}>
      {children}
    </FieldLayoutContext.Provider>
  );
}

export function useFieldLayout() {
  return useContext(FieldLayoutContext);
}
