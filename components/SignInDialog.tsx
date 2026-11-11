"use client";

// Modal for signing in with a Substratal account: sign in, create an account,
// the two-factor step, and "forgot password". Accounts are optional — the map
// works fully without one; an account just saves favorites and the theme.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "@/lib/account";

type Mode = "signIn" | "signUp" | "mfa" | "forgot" | "forgotSent";

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800";
const primary =
  "w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";
const link =
  "text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300";

export default function SignInDialog({ onClose }: { onClose: () => void }) {
  const { signIn, signUp, verifyMfa, forgotPassword } = useAccount.getState();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signIn") {
        const { mfaRequired } = await signIn(email, password);
        setPassword("");
        if (mfaRequired) return go("mfa");
        onClose();
      } else if (mode === "signUp") {
        await signUp(email, password, displayName);
        onClose();
      } else if (mode === "mfa") {
        await verifyMfa(useRecovery ? { recoveryCode: code } : { code });
        onClose();
      } else if (mode === "forgot") {
        await forgotPassword(email);
        go("forgotSent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const title: Record<Mode, string> = {
    signIn: "Sign in",
    signUp: "Create an account",
    mfa: "Two-factor code",
    forgot: "Reset your password",
    forgotSent: "Check your email",
  };

  // Portaled to <body>: the TopBar card uses backdrop-blur, which would make
  // it the containing block for this fixed overlay and trap it inside.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 id="signin-title" className="text-base font-semibold">
            {title[mode]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 rounded-full px-2 py-0.5 text-lg leading-none text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {(mode === "signIn" || mode === "signUp") && (
          <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
            Optional — save your Top 5 Routes, stops, and theme across devices. Uses a{" "}
            <a
              href="https://substratalapps.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Substratal Apps
            </a>{" "}
            account.
          </p>
        )}

        {mode === "forgotSent" ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              If there&apos;s an account for <span className="font-medium">{email}</span>, a reset
              link is on its way. Reset your password there, then sign in here.
            </p>
            <button type="button" className={primary} onClick={() => go("signIn")}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === "signUp" && (
              <Field label="Name (optional)">
                <input
                  className={input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                />
              </Field>
            )}

            {mode !== "mfa" && (
              <Field label="Email">
                <input
                  className={input}
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
            )}

            {(mode === "signIn" || mode === "signUp") && (
              <Field label="Password">
                <input
                  className={input}
                  type="password"
                  required
                  minLength={mode === "signUp" ? 12 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                />
                {mode === "signUp" && (
                  <span className="mt-1 block text-[11px] text-zinc-500 dark:text-zinc-400">
                    At least 12 characters.
                  </span>
                )}
              </Field>
            )}

            {mode === "mfa" && (
              <>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {useRecovery
                    ? "Enter one of your recovery codes."
                    : "Enter the 6-digit code from your authenticator app."}
                </p>
                <Field label={useRecovery ? "Recovery code" : "Code"}>
                  <input
                    className={input}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    inputMode={useRecovery ? "text" : "numeric"}
                  />
                </Field>
              </>
            )}

            {error && (
              <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
                {error}
              </p>
            )}

            <button type="submit" className={primary} disabled={busy}>
              {busy
                ? "Working…"
                : mode === "signUp"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "mfa"
                      ? "Verify"
                      : "Sign in"}
            </button>

            <div className="flex items-center justify-between pt-1">
              {mode === "signIn" && (
                <>
                  <button type="button" className={link} onClick={() => go("signUp")}>
                    Create an account
                  </button>
                  <button type="button" className={link} onClick={() => go("forgot")}>
                    Forgot password?
                  </button>
                </>
              )}
              {(mode === "signUp" || mode === "forgot") && (
                <button type="button" className={link} onClick={() => go("signIn")}>
                  I already have an account
                </button>
              )}
              {mode === "mfa" && (
                <>
                  <button
                    type="button"
                    className={link}
                    onClick={() => {
                      setUseRecovery((v) => !v);
                      setCode("");
                    }}
                  >
                    {useRecovery ? "Use an authenticator code" : "Use a recovery code"}
                  </button>
                  <button type="button" className={link} onClick={() => go("signIn")}>
                    Start over
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}
