import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Json } from "../supabase/database.types";
import type { InventoryState } from "./model";
import { createEmptyWorkspace } from "./emptyWorkspace";
import { loadInventory, readableError, sendCommand } from "./lib/inventory";
import { useAuth } from "./auth";

interface Store {
  state: InventoryState;
  command: (action: string, payload: Json, message: string) => Promise<boolean>;
  saving: boolean;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  notice: string;
  storageError: string;
}
const InventoryContext = createContext<Store | null>(null);
export function InventoryProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState(createEmptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [storageError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const retry = useRef<{ action: string; payload: string; id: string } | null>(
    null,
  );
  const email = session?.user.email || "";
  const userId = session?.user.id || "";
  const refresh = useCallback(async () => {
    try {
      setState(await loadInventory(email, userId));
      setError("");
    } catch (error) {
      setError(readableError(error));
      throw error;
    }
  }, [email, userId]);
  useEffect(() => {
    let cancelled = false;
    void loadInventory(email, userId)
      .then((next) => {
        if (!cancelled) {
          setState(next);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(readableError(error));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [email, userId]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function command(action: string, payload: Json, message: string) {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError("");
    const serialized = JSON.stringify(payload);
    if (
      retry.current?.action !== action ||
      retry.current.payload !== serialized
    )
      retry.current = { action, payload: serialized, id: crypto.randomUUID() };
    try {
      await sendCommand(retry.current.id, action, payload);
      // Render authoritative server state only after the entire command commits.
      await refresh();
      retry.current = null;
      setNotice(message);
      return true;
    } catch (error) {
      setError(readableError(error));
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  if (loading)
    return (
      <div className="workspace-loading" role="status">
        Loading inventory…
      </div>
    );
  if (storageError && state.settings.version === undefined)
    return (
      <div className="workspace-loading" role="alert">
        <div>
          <p>{storageError}</p>
          <button
            className="button primary"
            onClick={() => {
              setLoading(true);
              void refresh()
                .finally(() => setLoading(false))
                .catch((error) => setError(readableError(error)));
            }}
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  return (
    <InventoryContext.Provider
      value={{
        state,
        command,
        saving,
        refresh,
        notice,
        storageError,
        notify: setNotice,
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
