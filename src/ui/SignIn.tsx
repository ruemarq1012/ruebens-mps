import { useState, type FormEvent } from "react";
import type { Api } from "../lib/types";

export function SignIn({ api }: { api: Api }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@"))
      return setError("Enter the email address you were invited with.");
    setBusy(true);
    setError(null);
    try {
      if (!(await api.canSignIn(clean))) {
        setError(
          "That email isn't on the guest list. Ask Rueben to add you in the Kitchen.",
        );
        return;
      }
      await api.sendCode(clean);
      setStep("code");
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.verifyCode(email.trim().toLowerCase(), code.trim());
    } catch {
      setError(
        "That code didn't work. Check the newest email, or send a new code.",
      );
    } finally {
      setBusy(false);
    }
  }

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
          Preview mode: sign in as <b>you@example.com</b> with any code to look
          around.
        </p>
      )}

      {step === "email" ? (
        <form className="card form" onSubmit={sendCode}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <form className="card form" onSubmit={verify}>
          <label htmlFor="code">
            Enter the code sent to {email.trim().toLowerCase()}
          </label>
          <input
            id="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
          <button
            className="btn btn-primary"
            disabled={busy || code.length < 6}
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          {error && <p className="error">{error}</p>}
          <div className="row-between">
            <button
              type="button"
              className="link"
              onClick={() => setStep("email")}
            >
              Use a different email
            </button>
            <button
              type="button"
              className="link"
              onClick={() => sendCode()}
              disabled={busy}
            >
              Send a new code
            </button>
          </div>
        </form>
      )}
      <p className="fineprint">
        You'll stay signed in on this phone. No password needed.
      </p>
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
