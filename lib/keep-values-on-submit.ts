/**
 * lib/keep-values-on-submit.ts — submit a form to an action WITHOUT React clearing what was typed (KQ-30).
 *
 * React 19 resets a form's fields after `<form action={...}>` finishes, even when the server answered
 * with a validation error, so the host would lose their typing. Here we handle the submit ourselves:
 * preventDefault() stops both the browser and React's automatic handling, then we call the action
 * inside startTransition (so `pending` from useActionState still works).
 *
 * Keep `action={...}` on the form too: without JavaScript the browser still submits normally.
 */
import { startTransition, type FormEvent } from "react";

export function keepValuesOnSubmit(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
