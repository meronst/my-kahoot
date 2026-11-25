/**
 * app/j/[pin]/join-form.tsx — the nickname form. Runs in the phone's browser.
 *
 * Why the browser and not a Server Action: the phone talks to Supabase directly (architecture
 * principle). Two practical reasons:
 *   - Supabase limits anonymous sign-ins per IP address. Signing in from the browser counts the
 *     hall's IP; signing in from our server would count Vercel's few IPs for EVERY lecture at once.
 *   - The anonymous login lands in the phone's cookies via the browser client, so every later page
 *     (and a reload) knows who this player is: that's what makes reconnect work.
 *
 * Steps: anonymous sign-in (only if not signed in yet) → join_session() → go to the player screen.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinErrorMessage } from "@/lib/join-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/strings/he";

export function JoinForm({ pin, sessionId }: { pin: string; sessionId: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const supabase = getSupabaseBrowserClient();

    // Reuse the phone's existing login if it has one (e.g. joined another quiz earlier today).
    const { data: existing } = await supabase.auth.getSession();
    if (!existing.session) {
      const { error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        setError(joinErrorMessage(signInError));
        setPending(false);
        return;
      }
    }

    const { error: joinError } = await supabase.rpc("join_session", { p_pin: pin, p_nickname: nickname });
    if (joinError) {
      setError(joinErrorMessage(joinError));
      setPending(false);
      return;
    }
    router.replace(`/play/${sessionId}`); // replace: the Back button shouldn't return to the form
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <label className="flex flex-col gap-1 text-lg">
        <span>{t.join.nicknameLabel}</span>
        <input
          name="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          maxLength={20}
          autoComplete="nickname"
          dir="auto" // Hebrew or English names both display correctly
          className="rounded-lg border-2 border-current/30 bg-transparent px-4 py-3 text-center text-2xl"
        />
        <span className="text-sm opacity-70">{t.join.nicknameHint}</span>
      </label>
      {error && <p role="alert" data-testid="join-error" className="text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-3 text-xl font-bold text-white disabled:opacity-60"
      >
        {pending ? t.join.submitting : t.join.submit}
      </button>
    </form>
  );
}
