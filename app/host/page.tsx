/**
 * app/host/page.tsx — the host's home page (/host): who's signed in, and the quizzes to start.
 * The full quiz editor (create, edit, delete) comes in KQ-15; for now quizzes are listed with a
 * "start" button that opens a live session lobby.
 *
 * Concept — Suspense and streaming (Next.js "Cache Components"):
 *   Anything that depends on the request (here: who is logged in, read from cookies) can't be part of
 *   the static HTML built ahead of time. Wrapping it in <Suspense> lets Next.js send the page frame
 *   immediately and stream the signed-in part in a moment later, showing `fallback` meanwhile.
 *   With Cache Components on, reading cookies outside a Suspense boundary is a build error.
 */
import { Suspense } from "react";
import { getHost } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";
import { startSession } from "./actions";
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
    .select("id, title")
    .order("created_at", { ascending: false });
  if (error) throw error;

  if (!quizzes.length) return <p className="opacity-70">{t.host.noQuizzes}</p>;

  return (
    <section className="w-full">
      <h2 className="mb-3 text-xl font-bold">{t.host.quizzes}</h2>
      <ul className="flex flex-col gap-2">
        {quizzes.map((quiz) => (
          <li key={quiz.id} className="flex items-center justify-between gap-4 rounded-md border border-current/20 p-3">
            <span>{quiz.title}</span>
            <form action={startSession.bind(null, quiz.id)}>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white">
                {t.host.startSession}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
