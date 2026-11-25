/**
 * app/pin-form.tsx — "type the game code" box on the home page, for phones that didn't scan the QR.
 *
 * A Client Component because it reacts to typing (validation message) and navigates with the router.
 * `inputMode="numeric"` opens the number keypad on phones, which matters for older participants.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidPin, normalizePin } from "@/lib/join-errors";
import { t } from "@/strings/he";

export function PinForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stay in the app: navigate with the router instead of a full page load
    const clean = normalizePin(pin);
    if (!isValidPin(clean)) {
      setError(t.home.pinInvalid);
      return;
    }
    router.push(`/j/${clean}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <label className="flex flex-col gap-1 text-lg">
        <span>{t.home.pinLabel}</span>
        <input
          name="pin"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.home.pinPlaceholder}
          dir="ltr"
          maxLength={9}
          className="rounded-lg border-2 border-current/30 bg-transparent px-4 py-3 text-center text-3xl tracking-widest"
        />
      </label>
      {error && <p role="alert" data-testid="pin-error" className="text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 text-xl font-bold text-white">
        {t.home.go}
      </button>
    </form>
  );
}
