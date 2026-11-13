import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Box, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth";
import { supabase, configurationError } from "../lib/supabase";

export function Login() {
  const { error: accessError, recovery, session, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    document.title = "Sign in · EIMTS Inventory";
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (recovery) {
        if (password.length < 12 || password !== confirmation) {
          setError(
            "Use at least 12 characters and enter the same password twice.",
          );
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setError(
            "The password could not be updated. Open a fresh recovery link and try again.",
          );
          return;
        }
        await signOut();
        setPassword("");
        setConfirmation("");
        setMessage("Password updated. Sign in with your new password.");
      } else if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`,
          },
        );
        if (error) {
          setError(
            "The recovery request could not be sent. Try again shortly or contact IT.",
          );
          return;
        }
        setMessage(
          "If this email belongs to an account, a recovery link will arrive shortly.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error)
          setError(
            error.code === "email_not_confirmed"
              ? "Confirm your email before signing in. Check your inbox or contact the Supabase project administrator."
              : "Sign-in failed. Check your email and password and try again.",
          );
      }
    } catch {
      setError(
        "The sign-in service is unavailable. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <a className="login-brand" href="#login">
        <Box size={27} />
        <span>EIMTS Inventory</span>
      </a>
      <section className="login-card">
        <div className="login-mark">
          <Box size={27} />
        </div>
        <h1>
          {recovery
            ? "Set a new password"
            : reset
              ? "Reset your password"
              : "Sign in to Inventory"}
        </h1>
        <p className="login-subtitle">IT department’s asset workspace.</p>
        <form onSubmit={submit} className="login-form">
          {!recovery && (
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="Your work email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
              />
            </label>
          )}
          {(!reset || recovery) && (
            <label>
              {recovery ? "New password" : "Password"}
              <span className="password-field">
                <input
                  required
                  type={visible ? "text" : "password"}
                  minLength={recovery ? 12 : undefined}
                  autoComplete={recovery ? "new-password" : "current-password"}
                  placeholder={
                    recovery ? "At least 12 characters" : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>
          )}
          {recovery && (
            <label>
              Confirm new password
              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {(error || accessError) && (
            <p role="alert" className="login-error">
              {error || accessError}
            </p>
          )}
          {message && (
            <p role="status" className="login-reset-note">
              {message}
            </p>
          )}
          <button
            className="button primary login-submit"
            type="submit"
            disabled={busy || Boolean(configurationError)}
          >
            {busy
              ? "Please wait…"
              : recovery
                ? "Update password"
                : reset
                  ? "Send recovery link"
                  : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        {!recovery && (
          <button
            className="login-reset"
            onClick={() => {
              setReset((v) => !v);
              setError("");
              setMessage("");
            }}
          >
            {reset ? "Back to sign in" : "Forgot your password?"}
          </button>
        )}
        {session && (
          <button className="login-reset" onClick={() => void signOut()}>
            Sign out of this account
          </button>
        )}
        <p className="login-reset-note">
          <ShieldCheck size={16} /> Access is limited to approved IT accounts.
        </p>
      </section>
      <footer className="login-footer-menu">
        <p>
          © {new Date().getFullYear()} EIMTS Inventory. All rights reserved.
        </p>
        <p>Made with ❤️</p>
      </footer>
    </main>
  );
}