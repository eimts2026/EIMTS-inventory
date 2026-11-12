import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Box, Eye, EyeOff, ShieldCheck } from "lucide-react";

export function Login({ onLogin }: { onLogin: () => void }) {
  useEffect(() => {
    document.title = "Sign in · EIMTS Inventory";
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(false);
  function signIn(event: FormEvent) {
    event.preventDefault();
    if (
      email.trim().toLowerCase() !== "it@eimts.demo" ||
      password !== "Inventory123!"
    ) {
      setError("Use the demo email and password shown below.");
      return;
    }
    onLogin();
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
        <h1>Sign in to Inventory</h1>
        <p className="login-subtitle">IT department’s asset workspace.</p>
        <form onSubmit={signIn} className="login-form">
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="username"
              placeholder="it@eimts.demo"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
            />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                required
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter the demo password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          <button className="button primary login-submit" type="submit">
            Sign in
            <ArrowRight size={18} />
          </button>
        </form>
        <button
          className="login-reset"
          onClick={() => setReset((value) => !value)}
        >
          Forgot your password?
        </button>
        {reset && (
          <p role="status" className="login-reset-note">
            For this preview, use the demo credentials below. IT account
            recovery will be connected in the backend step.
          </p>
        )}
        <div className="demo-credentials">
          <span>
            <ShieldCheck size={16} />
            Frontend demo
          </span>
          <p>
            Email <strong>it@eimts.demo</strong>
          </p>
          <p>
            Password <strong>Inventory123!</strong>
          </p>
        </div>
      </section>
      <footer className="login-footer-menu">
        <p>© {new Date().getFullYear()} EIMTS Inventory. All rights reserved.</p>
        <p>Made with ❤️</p>
      </footer>
    </main>
  );
}
