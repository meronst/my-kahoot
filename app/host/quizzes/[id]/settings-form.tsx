/**
 * app/host/quizzes/[id]/settings-form.tsx — title, scoring mode and the collect-phone switch.
 *
 * useActionState (introduced in the login form) runs saveQuizSettings on the server and shows
 * "saved" or an error. `saveQuizSettings.bind(null, quiz.id)` pre-fills which quiz to save.
 * keepValuesOnSubmit: after an error the fields keep what was typed (KQ-30).
 */
"use client";

import { useActionState } from "react";
import { saveQuizSettings, type SettingsState } from "@/app/host/actions";
import { keepValuesOnSubmit } from "@/lib/keep-values-on-submit";
import { SCORING_MODES } from "@/lib/quiz-settings";
import type { ScoringMode } from "@/lib/scoring";
import { t } from "@/strings/he";

type Quiz = { id: string; title: string; scoring_mode: ScoringMode; collect_phone: boolean };

export function SettingsForm({ quiz }: { quiz: Quiz }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveQuizSettings.bind(null, quiz.id),
    {},
  );

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="flex flex-col gap-4 rounded-lg border border-current/20 p-4">
      <h2 className="text-xl font-bold">{t.quiz.settings}</h2>

      <label className="flex flex-col gap-1">
        <span>{t.quiz.title}</span>
        <input
          name="title"
          defaultValue={quiz.title}
          required
          maxLength={120}
          dir="auto"
          className="rounded-md border border-current/30 bg-transparent px-3 py-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">{t.quiz.scoringMode}</legend>
        {SCORING_MODES.map((mode) => (
          <label key={mode} className="flex items-center gap-2">
            <input type="radio" name="scoring_mode" value={mode} defaultChecked={quiz.scoring_mode === mode} />
            <span>{t.quiz.modes[mode]}</span>
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="collect_phone" defaultChecked={quiz.collect_phone} />
        <span>{t.quiz.collectPhone}</span>
      </label>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-60">
          {pending ? t.quiz.saving : t.quiz.save}
        </button>
        {state.saved && !pending && <span data-testid="settings-saved" className="text-green-700 dark:text-green-400">{t.quiz.saved}</span>}
        {state.error && <span role="alert" data-testid="settings-error" className="text-red-600 dark:text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}
