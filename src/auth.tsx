import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, configurationError } from "./lib/supabase";
import type { Database } from "../supabase/database.types";

type Membership = Database["public"]["Tables"]["it_members"]["Row"];
const AuthContext = createContext<{
  session: Session | null;
  member: Membership | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  signOut: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(configurationError);
  const [recovery, setRecovery] = useState(
    /type=recovery|reset-password/.test(window.location.hash),
  );
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setError("Your session could not be restored. Sign in again.");
        setLoading(false);
      }
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    // Keep the callback synchronous. Membership is loaded outside Auth's lock.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next);
      if (!next) {
        setMember(null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;
    const client = supabase;
    setLoading(true);
    async function check() {
      const { data, error } = await client
        .from("it_members")
        .select("*")
        .eq("user_id", session!.user.id)
        .eq("active", true)
        .maybeSingle();
      if (cancelled) return;
      setMember(data);
      setError(
        error
          ? "IT access could not be checked. Check your connection and try again."
          : data
            ? ""
            : "This account has no active IT inventory access. Contact your IT administrator.",
      );
      setLoading(false);
    }
    void check();
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 30000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, [session]);
  async function signOut() {
    // Local sign-out clears this device even if network token revocation fails.
    await supabase?.auth.signOut({ scope: "local" });
    setSession(null);
    setMember(null);
    setRecovery(false);
    setError(configurationError);
    window.location.hash = "login";
  }
  return (
    <AuthContext.Provider
      value={{ session, member, loading, error, recovery, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is required");
  return auth;
}
