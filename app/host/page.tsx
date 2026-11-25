/**
 * app/host/page.tsx — the host's home page (/host). Placeholder until the quiz list (KQ-15).
 *
 * Concept — Suspense and streaming (Next.js "Cache Components"):
 *   Anything that depends on the request (here: who is logged in, read from cookies) can't be part of
 *   the static HTML built ahead of time. Wrapping it in <Suspense> lets Next.js send the page frame
 *   immediately and stream the signed-in part in a moment later, showing `fallback` meanwhile.
 *   With Cache Components on, reading cookies outside a Suspense boundary is a build error.
 */
import { Suspense } from "react";
import { getHost } from "@/lib/auth";
import { t } from "@/strings/he";
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
    <div className="flex flex-col items-center gap-4">
      <p>
        {t.host.signedInAs}{" "}
        {/* <bdi> isolates the Latin email inside the Hebrew sentence so punctuation stays in place. */}
        <bdi data-testid="host-email">{host.email}</bdi>
      </p>
      <p className="opacity-70">{t.host.comingSoon}</p>
      {/* A form whose action is a Server Action: works even before JavaScript has loaded. */}
      <form action={signOut}>
        <button type="submit" className="rounded-md border border-current/30 px-4 py-2">
          {t.host.signOut}
        </button>
      </form>
    </div>
  );
}
