/**
 * app/host/sessions/[id]/page.tsx — the projector page for one live session (/host/sessions/<id>).
 *
 * The SERVER part: checks the host, loads the session, its quiz title and players, and draws the QR
 * code. Then hands everything to <Projector>, the CLIENT part that follows the game live
 * (lobby → questions → reveals → pause → end).
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
import { Projector } from "./projector";

export default function SessionPage({ params }: PageProps<"/host/sessions/[id]">) {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <Suspense fallback={<p>{t.host.loading}</p>}>
        <SessionLoader params={params} />
      </Suspense>
    </main>
  );
}

async function SessionLoader({ params }: { params: Promise<{ id: string }> }) {
  await getHost();
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  // `quizzes(title)` follows the foreign key sessions.quiz_id → quizzes: one query, like a JOIN.
  const { data: row } = await supabase.from("sessions").select("*, quizzes(title)").eq("id", id).maybeSingle();
  if (!row) notFound(); // missing, or not this host's (RLS hides it): same answer either way
  const { quizzes, ...session } = row;

  const { data: players } = await supabase
    .from("players").select("id, nickname").eq("session_id", id).order("joined_at");

  const joinUrl = await joinUrlFor(session.pin);
  // The QR code is generated on the server as an SVG string: sharp at projector size, no extra request.
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <Projector
      initialSession={session}
      initialPlayers={players ?? []}
      title={quizzes?.title ?? ""}
      joinUrl={joinUrl}
      qrSvg={qrSvg}
    />
  );
}

/**
 * The address a phone opens to join: https://<this site>/j/<PIN>.
 * Built from the request's own host name, so it's right on localhost, on Vercel previews and in production.
 */
async function joinUrlFor(pin: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/j/${pin}`;
}
