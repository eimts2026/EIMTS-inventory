import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./database-status.css";

export function DatabaseStatus() {
  const [status, setStatus] = useState("Checking");
  useEffect(() => {
    let current: AbortController | undefined;
    let stopped = false;
    async function check() {
      current?.abort();
      const request = new AbortController();
      current = request;
      if (!navigator.onLine || !supabase) {
        setStatus("Offline");
        return;
      }
      const timeout = window.setTimeout(() => request.abort(), 8000);
      let next = "Unavailable";
      try {
        // Read one protected settings row using the current IT session.
        const { data, error } = await supabase.from("workspace_settings")
          .select("id").eq("id", true).abortSignal(request.signal).maybeSingle();
        if (data && !error) next = "Live";
      } catch {
        // Network failures and timeouts leave the database unavailable.
      } finally {
        window.clearTimeout(timeout);
        if (!stopped && current === request) setStatus(next);
      }
    }
    void check();
    const timer = window.setInterval(check, 30000);
    const events = ["online", "offline", "focus"];
    events.forEach(event => window.addEventListener(event, check));
    return () => {
      stopped = true;
      current?.abort();
      window.clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, check));
    };
  }, []);
  return <span className="db-status" data-status={status} role="status"
    aria-label={`Database status: ${status}`} title={`Database: ${status}`}>{status}</span>;
}
