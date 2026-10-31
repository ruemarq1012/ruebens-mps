import { useState, type FormEvent } from "react";
import type { Api } from "../lib/types";

type Step = "email" | "password" | "create";

export function SignIn({ api }: { api: Api }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = email.trim().toLowerCase();

  async function next(e: FormEvent) {
    e.preventDefault();
    if (!clean.includes("@"))
      return setError("Enter the email address you were invited with.");
    setBusy(true);
    setError(null);
    try {
      const status = await api.accountStatus(clean);
      if (status === "not_member")
        setError(
          "That email isn't on the guest list. Ask Rueben to add you in the Kitchen.",
        );
      else {
        setPassword("");
        setConfirm("");
        setStep(status === "existing" ? "password" : "create");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === "create") {
      if (password.length < 8)
        return setError("Use at least 8 characters for your password.");
      if (password !== confirm)
        return setError("The two passwords don't match.");
    }
    setBusy(true);
    setError(null);
    try {
      if (step === "create") await api.createAccount(clean, password);
      else await api.signIn(clean, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setStep("email");
    setError(null);
  };

  return (
    <div className="signin">
      <div className="signin-hero">
        <div className="sticker sticker-logo" aria-hidden="true">
          MPS
        </div>
        <h1>Rueben's Meal Prep Service</h1>
        <p>Four dinners a week, picked by you, shopped and cooked at home.</p>
      </div>

      {api.mode === "demo" && (
        <p className="notice">
          Preview mode: sign in as <b>you@example.com</b> with any password to
          look around.
        </p>
      )}

      {step === "email" ? (
        <form className="card form" onSubmit={next}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <form className="card form" onSubmit={submit}>
          {/* Hidden username field lets password managers save the pair. */}
          <input
            type="email"
            autoComplete="username"
            value={clean}
            readOnly
            hidden
          />
          {step === "create" ? (
            <>
              <h2 className="form-title">Welcome! Create your password</h2>
              <p className="muted small">
                For {clean}. You'll only need it when you sign in on a new
                phone.
              </p>
              <label htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              <label htmlFor="pw2">Type it again</label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Create password and sign in"}
              </button>
            </>
          ) : (
            <>
              <h2 className="form-title">Welcome back</h2>
              <p className="muted small">{clean}</p>
              <label htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button type="button" className="link" onClick={back}>
            Use a different email
          </button>
        </form>
      )}
      <p className="fineprint">You'll stay signed in on this phone.</p>
    </div>
  );
}

export function NotInvited({ api, email }: { api: Api; email: string }) {
  return (
    <div className="signin">
      <div className="signin-hero">
        <div className="sticker sticker-logo" aria-hidden="true">
          MPS
        </div>
        <h1>You're not on the guest list yet</h1>
        <p>
          {email} isn't part of this kitchen. Ask Rueben to add you in the
          Kitchen tab, then sign in again.
        </p>
      </div>
      <button className="btn" onClick={() => api.signOut()}>
        Sign out
      </button>
    </div>
  );
}
