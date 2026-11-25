/**
 * components/confirm-button.tsx — a button that needs two clicks: the first "arms" it and changes the
 * label to a question, the second does the action. Disarms itself after 5 seconds.
 *
 * Used for destructive actions (delete a quiz). An inline confirm instead of a browser pop-up works
 * the same on a laptop, a phone and a projector clicker, and can't be blocked by the browser.
 *
 * `action` is a Server Action (or any function); the button submits a tiny form, so it also works
 * before the page's JavaScript has loaded.
 */
"use client";

import { useEffect, useState } from "react";

type Props = {
  label: string;
  confirmLabel: string;
  action: () => void | Promise<void>;
  testId?: string;
  className?: string;
};

export function ConfirmButton({ label, confirmLabel, action, testId, className = "" }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(id);
  }, [armed]);

  if (!armed) {
    return (
      <button type="button" data-testid={testId} onClick={() => setArmed(true)} className={className}>
        {label}
      </button>
    );
  }
  return (
    <form action={action}>
      <button
        type="submit"
        data-testid={testId}
        data-armed="true"
        className={`${className} border-red-600 text-red-600 dark:text-red-400`}
      >
        {confirmLabel}
      </button>
    </form>
  );
}
