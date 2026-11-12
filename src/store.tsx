import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { InventoryState } from "./model";
import { now, officerName, uid } from "./model";
import { createSeed } from "./seed";
import { inventorySchema } from "./schema";

const storageKey = "eimts-inventory-preview-v1";
interface Store {
  state: InventoryState;
  commit: (
    action: string,
    subject: string,
    mutate: (draft: InventoryState) => void,
  ) => void;
  replace: (state: InventoryState) => void;
  notify: (message: string) => void;
  notice: string;
  storageError: string;
}
const InventoryContext = createContext<Store | null>(null);

function load(): InventoryState {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = inventorySchema.safeParse(JSON.parse(saved));
      if (parsed.success) return parsed.data;
    }
  } catch {
    /* A fresh sample workspace keeps an unavailable browser store usable. */
  }
  return createSeed();
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable. Export your preview data before closing this page.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (notice) {
      const timer = window.setTimeout(() => setNotice(""), 4500);
      return () => window.clearTimeout(timer);
    }
  }, [notice]);
  function commit(
    action: string,
    subject: string,
    mutate: (draft: InventoryState) => void,
  ) {
    const entry = {
      id: uid(),
      date: now(),
      action,
      subject,
      officer: officerName,
    };
    setState((previous) => {
      const draft = structuredClone(previous);
      mutate(draft);
      draft.activity.unshift(entry);
      return draft;
    });
    setNotice(action);
  }
  return (
    <InventoryContext.Provider
      value={{
        state,
        commit,
        replace: setState,
        notify: setNotice,
        notice,
        storageError,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}
export function useInventory() {
  const store = useContext(InventoryContext);
  if (!store) throw new Error("InventoryProvider is required.");
  return store;
}
