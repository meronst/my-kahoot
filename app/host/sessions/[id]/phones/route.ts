/**
 * app/host/sessions/[id]/phones/route.ts — download the phone numbers of a session as CSV (KQ-19).
 *
 * Concept — Route Handler: a file named route.ts answers HTTP requests directly (like a Spring
 * @GetMapping or a Flask view) instead of rendering a page. Here: GET → a file download.
 *
 * Only the host gets numbers: getHost() checks the login, and RLS on players returns phone numbers only
 * for sessions of this host's quizzes. Nothing here logs the numbers; "no-store" keeps the file out of
 * any cache.
 */
import { getHost } from "@/lib/auth";
import { phonesCsv } from "@/lib/phones-csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/host/sessions/[id]/phones">) {
  await getHost();
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase.from("sessions").select("pin").eq("id", id).maybeSingle();
  if (!session) return new Response("Not found", { status: 404 });

  const { data, error } = await supabase
    .from("players")
    .select("nickname, phone, phone_consent_at")
    .eq("session_id", id)
    .not("phone", "is", null)
    .order("joined_at");
  if (error) return new Response("Error", { status: 500 });

  const rows = (data ?? []).map((r) => ({ ...r, phone: r.phone ?? "" }));
  return new Response(phonesCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="phones-${session.pin}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
