"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";

export interface FieldLayoutContextValue {
  modalLayout: string[];
  listLayout: string[];
  userListLayout: string[];
  /** Re-fetches all layouts from the server — call after creating/deleting custom fields */
  refresh: () => Promise<void>;
  /** Saves the calling user's task modal layout */
  saveModalLayout: (layout: string[]) => Promise<void>;
  /** Saves the calling user's task list layout */
  saveListLayout: (layout: string[]) => Promise<void>;
  /** Saves the calling user's user management table layout */
  saveUserListLayout: (layout: string[]) => Promise<void>;
}

const FieldLayoutContext = createContext<FieldLayoutContextValue>({
  modalLayout: [],
  listLayout: [],
  userListLayout: [],
  refresh: async () => {},
  saveModalLayout: async () => {},
  saveListLayout: async () => {},
  saveUserListLayout: async () => {},
});

export function FieldLayoutProvider({ children }: { children: React.ReactNode }) {
  const [modalLayout, setModalLayout] = useState<string[]>([]);
  const [listLayout, setListLayout] = useState<string[]>([]);
  const [userListLayout, setUserListLayout] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/field-layout");
      if (res.ok) {
        const json = await res.json();
        setModalLayout(json.data?.modalLayout ?? []);
        setListLayout(json.data?.listLayout ?? []);
        setUserListLayout(json.data?.userListLayout ?? []);
      }
    } catch {
      // silently ignore; layouts fall back to default order
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

  const saveUserListLayout = useCallback(async (layout: string[]) => {
    await fetch("/api/admin/settings/field-layout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userListLayout: layout }),
    });
    setUserListLayout(layout);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FieldLayoutContext.Provider value={{ modalLayout, listLayout, userListLayout, refresh, saveModalLayout, saveListLayout, saveUserListLayout }}>
      {children}
    </FieldLayoutContext.Provider>
  );
}

export function useFieldLayout() {
  return useContext(FieldLayoutContext);
}
