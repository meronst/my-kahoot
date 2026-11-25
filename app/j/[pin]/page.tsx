/**
 * app/j/[pin]/page.tsx — the join page a phone opens from the QR code (/j/<PIN>).
 *
 * Shows the quiz title (so people know they're in the right place) and the nickname form.
 * If this phone already joined this session (e.g. it scanned the QR again), it goes straight back to
 * its player screen: that's the "reconnect" path.
 *
 * Server side: reads the public preview with session_preview() (title + open/closed only).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isValidPin } from "@/lib/join-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";
import { JoinForm } from "./join-form";

export default function JoinPage({ params }: PageProps<"/j/[pin]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Suspense fallback={<p>…</p>}>
        <Join params={params} />
      </Suspense>
    </main>
  );
}

async function Join({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params;
  if (!isValidPin(pin)) return <Closed message={t.join.notFound} />;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("session_preview", { p_pin: pin });
  const session = data?.[0];
  if (!session) return <Closed message={t.join.notFound} />;

  // Already joined from this phone? Back to the player screen (works even after the quiz ended,
  // so a player can still see their final screen).
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims) {
    const { data: me } = await supabase
      .from("players").select("id").eq("session_id", session.session_id).maybeSingle();
    if (me) redirect(`/play/${session.session_id}`);
  }

  if (!session.is_open) return <Closed message={t.join.ended} />;

  return (
    <>
      <p className="text-lg opacity-80">{t.join.joiningQuiz}</p>
      <h1 data-testid="quiz-title" className="text-3xl font-bold">{session.quiz_title}</h1>
      <JoinForm pin={pin} sessionId={session.session_id} />
    </>
  );
}

function Closed({ message }: { message: string }) {
  return (
    <>
      <p data-testid="join-closed" className="text-2xl font-bold">{message}</p>
      <Link href="/" className="underline">{t.join.backHome}</Link>
    </>
  );
}
