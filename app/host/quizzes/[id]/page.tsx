/**
 * app/host/quizzes/[id]/page.tsx — editing one quiz (/host/quizzes/<id>).
 * KQ-15: the quiz's settings (title, scoring mode, collect phone numbers).
 * KQ-16 adds the rounds and questions editor below the settings.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getHost } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";
import { SettingsForm } from "./settings-form";

export default function QuizPage({ params }: PageProps<"/host/quizzes/[id]">) {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-6">
      <Suspense fallback={<p>{t.host.loading}</p>}>
        <QuizEditor params={params} />
      </Suspense>
    </main>
  );
}

async function QuizEditor({ params }: { params: Promise<{ id: string }> }) {
  await getHost();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: quiz } = await supabase
    .from("quizzes").select("id, title, scoring_mode, collect_phone").eq("id", id).maybeSingle();
  if (!quiz) notFound(); // missing, or another host's (RLS hides it)

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <Link href="/host" className="underline">{t.quiz.backToList}</Link>
      <h1 data-testid="quiz-heading" className="text-3xl font-bold">{quiz.title}</h1>
      <SettingsForm quiz={quiz} />
      <p className="opacity-70">{t.quiz.questionsSoon}</p>
    </div>
  );
}
