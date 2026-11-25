/**
 * app/host/login/login-form.tsx — the email + password form (a Client Component).
 *
 * Concept — Client Components ("use client"):
 *   Most of our components run only on the server. This one also runs in the browser, because it
 *   shows live UI state: the "logging in…" text while waiting, and the error message after.
 *
 * Concept — hooks: functions starting with `use` (useActionState here) give a component memory
 * between renders. useActionState(signIn, {}) returns:
 *   state    — what signIn returned last time (e.g. { error: "..." })
 *   action   — what to put in <form action>; it calls signIn on the server
 *   pending  — true while the server is working, to disable the button
 */
"use client";

import { useActionState } from "react";
import { t } from "@/strings/he";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span>{t.login.email}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr" // email addresses are Latin text: type them left-to-right
          defaultValue={state.email}
          className="rounded-md border border-current/30 bg-transparent px-3 py-2 text-start"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>{t.login.password}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="rounded-md border border-current/30 bg-transparent px-3 py-2 text-start"
        />
      </label>

      {/* role="alert" makes screen readers announce the error as soon as it appears. */}
      {state.error && (
        <p role="alert" data-testid="login-error" className="text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-60"
      >
        {pending ? t.login.submitting : t.login.submit}
      </button>
    </form>
  );
}
