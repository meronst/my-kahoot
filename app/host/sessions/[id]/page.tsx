/**
 * app/host/sessions/[id]/page.tsx — the projector screen for one live session (/host/sessions/<id>).
 * KQ-7 shows the LOBBY: quiz title, big PIN, QR code to join, and players appearing live.
 * The question/reveal screens (KQ-10) will be added to this page.
 *
 * Concept — dynamic route: the folder name `[id]` is a placeholder; /host/sessions/abc gives
 * params.id === "abc". In Next.js 16 `params` is a Promise and counts as request data, so we pass it
 * down and only await it inside the Suspense boundary (the page frame still renders instantly).
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { getHost } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";
import { LobbyPlayers } from "./lobby-players";

export default function SessionPage({ params }: PageProps<"/host/sessions/[id]">) {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <Suspense fallback={<p>{t.host.loading}</p>}>
        <Lobby params={params} />
      </Suspense>
    </main>
  );
}

async function Lobby({ params }: { params: Promise<{ id: string }> }) {
  await getHost();
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  // `quizzes(title)` follows the foreign key sessions.quiz_id → quizzes: one query, like a JOIN.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, pin, status, quizzes(title)")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound(); // missing, or not this host's (RLS hides it): same answer either way

  const { data: players } = await supabase
    .from("players")
    .select("id, nickname")
    .eq("session_id", id)
    .order("joined_at");

  const joinUrl = await joinUrlFor(session.pin);
  // The QR code is generated on the server as an SVG string: sharp at projector size, no extra request.
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <>
      <h1 className="text-4xl font-bold">{session.quizzes?.title}</h1>

      <div className="flex flex-wrap items-center justify-center gap-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-2xl">{t.lobby.joinAt}</p>
          {/* The join address is Latin text: <bdi> keeps it readable inside the RTL layout. */}
          <bdi className="text-2xl font-bold" dir="ltr">{joinUrl.replace(/^https?:\/\//, "")}</bdi>
          <p className="text-xl">{t.lobby.pinLabel}</p>
          <bdi data-testid="session-pin" dir="ltr" className="text-7xl font-black tracking-widest">
            {session.pin}
          </bdi>
          <p className="max-w-xs opacity-70">{t.lobby.scanOrEnter}</p>
        </div>
        <div
          role="img"
          aria-label={t.lobby.qrAlt}
          data-testid="join-qr"
          className="size-64 rounded-lg bg-white p-2"
          // Safe: the SVG comes from our own QR library, not from user input.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      <LobbyPlayers sessionId={session.id} initialPlayers={players ?? []} />
    </>
  );
}

/**
 * The address a phone opens to join: https://<this site>/j/<PIN> (the join page is KQ-8).
 * Built from the request's own host name, so it's right on localhost, on Vercel previews and in production.
 */
async function joinUrlFor(pin: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/j/${pin}`;
}
