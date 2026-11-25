/**
 * app/host/page.tsx — the host's home page (/host): who's signed in, and the quizzes to start.
 * Each quiz: start a live session, edit, duplicate, delete (two-click confirm). Plus "new quiz".
 *
 * Concept — Suspense and streaming (Next.js "Cache Components"):
 *   Anything that depends on the request (here: who is logged in, read from cookies) can't be part of
 *   the static HTML built ahead of time. Wrapping it in <Suspense> lets Next.js send the page frame
 *   immediately and stream the signed-in part in a moment later, showing `fallback` meanwhile.
 *   With Cache Components on, reading cookies outside a Suspense boundary is a build error.
 */
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { getHost } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";
import { createQuiz, deleteQuiz, duplicateQuiz, startSession } from "./actions";
import { signOut } from "./login/actions";

export default function HostPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">{t.host.title}</h1>
      <Suspense fallback={<p>{t.host.loading}</p>}>
        <SignedInHost />
      </Suspense>
    </main>
  );
}

/** Reads the session: redirects to /host/login unless the visitor is the host. */
async function SignedInHost() {
  const host = await getHost();
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <p>
        {t.host.signedInAs}{" "}
        {/* <bdi> isolates the Latin email inside the Hebrew sentence so punctuation stays in place. */}
        <bdi data-testid="host-email">{host.email}</bdi>
      </p>
      <QuizList />
      {/* A form whose action is a Server Action: works even before JavaScript has loaded. */}
      <form action={signOut}>
        <button type="submit" className="rounded-md border border-current/30 px-4 py-2">
          {t.host.signOut}
        </button>
      </form>
    </div>
  );
}

/** The host's quizzes, newest first. RLS returns only quizzes this host owns. */
async function QuizList() {
  const supabase = await createSupabaseServerClient();
  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("id, title, scoring_mode")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const small = "rounded-md border border-current/30 px-3 py-1 text-sm";
  return (
    <section className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.host.quizzes}</h2>
        <form action={createQuiz}>
          <button type="submit" data-testid="new-quiz" className="rounded-md bg-green-600 px-4 py-2 font-bold text-white">
            {t.host.newQuiz}
          </button>
        </form>
      </div>
      {!quizzes.length && <p className="opacity-70">{t.host.noQuizzes}</p>}
      <ul className="flex flex-col gap-2">
        {quizzes.map((quiz) => (
          <li key={quiz.id} data-testid="quiz-row" className="flex flex-col gap-2 rounded-md border border-current/20 p-3">
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold">{quiz.title}</span>
              <form action={startSession.bind(null, quiz.id)}>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white">
                  {t.host.startSession}
                </button>
              </form>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-70">{t.quiz.modes[quiz.scoring_mode]}</span>
              <Link href={`/host/quizzes/${quiz.id}`} data-testid="edit-quiz" className={small}>{t.host.edit}</Link>
              <form action={duplicateQuiz.bind(null, quiz.id)}>
                <button type="submit" data-testid="duplicate-quiz" className={small}>{t.host.duplicate}</button>
              </form>
              <ConfirmButton
                label={t.host.delete}
                confirmLabel={t.host.deleteConfirm}
                action={deleteQuiz.bind(null, quiz.id)}
                testId="delete-quiz"
                className={small}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
