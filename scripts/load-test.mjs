/**
 * scripts/load-test.mjs — simulates a full lecture hall against the CLOUD Supabase project (KQ-12).
 *
 * N players (default 150) join with anonymous logins like real phones, listen on Realtime exactly as
 * the phone screen does, and answer Q questions (default 5) while a simulated host drives the game.
 * Measures: peak Realtime connections, messages/second, how fast each state change reaches the
 * phones, answer latency and errors, and "dropped" players (missed a state change or lost the channel).
 *
 * Everything runs as a throw-away host (load-test-host-<time>@my-kahoot.local) that is deleted at the
 * end together with its quiz, session and the anonymous players, so Meron's data is never touched.
 *
 * Run (from GitHub Actions, see .github/workflows/load-test.yml):
 *   SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… node scripts/load-test.mjs
 * Optional: PLAYERS=150 QUESTIONS=5 JOIN_PER_SECOND=30
 */
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const URL_ = need("SUPABASE_URL");
const PUBLISHABLE = need("SUPABASE_PUBLISHABLE_KEY");
const SECRET = need("SUPABASE_SECRET_KEY");
const PLAYERS = Number(process.env.PLAYERS ?? 150);
const QUESTIONS = Number(process.env.QUESTIONS ?? 5);
const JOIN_PER_SECOND = Number(process.env.JOIN_PER_SECOND ?? 30);

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const client = () => createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
const pct = (values, p) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

// ── message counter: every Realtime message any simulated client receives, per second ───────────
const perSecond = new Map();
const countMessage = () => {
  const sec = Math.floor(Date.now() / 1000);
  perSecond.set(sec, (perSecond.get(sec) ?? 0) + 1);
};

const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const hostEmail = `load-test-host-${stamp}@my-kahoot.local`;
const hostPassword = randomUUID();
const anonymousIds = [];
let hostId;

async function main() {
  // 1. Throw-away host, quiz and session.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: hostEmail, password: hostPassword, email_confirm: true, app_metadata: { role: "host" },
  });
  if (createErr) throw createErr;
  hostId = created.user.id;
  const host = client();
  await host.auth.signInWithPassword({ email: hostEmail, password: hostPassword });

  const { data: quiz, error: quizErr } = await host.from("quizzes").insert({ title: `בדיקת עומס ${stamp}` }).select().single();
  if (quizErr) throw quizErr;
  const questions = Array.from({ length: QUESTIONS }, (_, i) => ({
    type: "mc", text: `שאלה ${i + 1}`, time_limit_sec: null, explanation: null,
    options: ["א", "ב", "ג", "ד"].map((text, k) => ({ text, correct: k === i % 4 })),
  }));
  const { error: importErr } = await host.rpc("import_rounds", { p_quiz_id: quiz.id, p_rounds: [{ title: null, questions }] });
  if (importErr) throw importErr;
  const { data: session, error: sessionErr } = await host.rpc("create_session", { p_quiz_id: quiz.id });
  if (sessionErr) throw sessionErr;
  console.log(`session ${session.id} pin ${session.pin}; joining ${PLAYERS} players at ${JOIN_PER_SECOND}/s`);

  // 2. Projector simulation: the host listens to answers like the projector does.
  let answersSeen = 0;
  await host.realtime.setAuth();
  const projector = host
    .channel(`answers:${session.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "answers", filter: `session_id=eq.${session.id}` }, () => {
      countMessage();
      answersSeen++;
    })
    .subscribe();

  // 3. Players.
  const players = [];
  const joinStart = now();
  for (let i = 0; i < PLAYERS; i++) {
    players.push(startPlayer(i, session));
    if ((i + 1) % JOIN_PER_SECOND === 0) await sleep(1000);
  }
  // Wait until everyone joined and is listening (or 90 s).
  const deadline = now() + 90_000;
  while (now() < deadline && players.filter((p) => p.ready || p.failed).length < PLAYERS) await sleep(250);
  const joinSeconds = (now() - joinStart) / 1000;
  const ready = players.filter((p) => p.ready).length;
  console.log(`${ready}/${PLAYERS} players ready after ${joinSeconds.toFixed(1)} s`);

  // 4. The game: start, then for each question wait for answers (max 20 s), reveal, wait 3 s, next.
  const moves = [];
  const move = async (name) => {
    const t0 = now();
    const { data, error } = await host.rpc(name, { p_session_id: session.id });
    if (error) throw new Error(`${name}: ${error.message}`);
    moves.push({ name, status: data.status, key: `${data.status}:${data.question_idx}`, at: t0, rpcMs: now() - t0 });
    return data;
  };
  let state = await move("start_session");
  for (let q = 0; q < QUESTIONS; q++) {
    const target = answersSeen + ready;
    const until = now() + 20_000;
    while (now() < until && answersSeen < target) await sleep(200);
    await move("reveal_question");
    await sleep(3000);
    state = await move("next_question");
  }
  if (state.status !== "finished") await move("finish_session");
  await sleep(3000); // let the last messages arrive

  // 5. Report.
  const transitions = moves.map((m) => {
    const lat = players.filter((p) => p.ready).map((p) => p.seen.get(m.key)).filter((t) => t !== undefined).map((t) => t - m.at);
    return { move: m.name, state: m.key, rpcMs: Math.round(m.rpcMs), reached: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), max: pct(lat, 100) };
  });
  const answerMs = players.flatMap((p) => p.answerMs);
  const dropped = players.filter((p) => p.ready && (p.channelLost || moves.some((m) => !p.seen.has(m.key))));
  const report = {
    players: PLAYERS,
    questions: QUESTIONS,
    joined: players.filter((p) => p.joined).length,
    ready,
    joinSeconds: Number(joinSeconds.toFixed(1)),
    joinErrors: tally(players.map((p) => p.joinError).filter(Boolean)),
    peakConnections: Math.max(...connectionSamples, 0),
    peakMessagesPerSecond: Math.max(...perSecond.values(), 0),
    totalMessages: [...perSecond.values()].reduce((a, b) => a + b, 0),
    answers: { sent: answerMs.length, errors: tally(players.flatMap((p) => p.answerErrors)), p50: pct(answerMs, 50), p95: pct(answerMs, 95), max: pct(answerMs, 100) },
    projectorAnswersSeen: answersSeen,
    dropped: dropped.length,
    droppedDetail: dropped.slice(0, 10).map((p) => ({ i: p.i, channelLost: p.channelLost, missed: moves.filter((m) => !p.seen.has(m.key)).map((m) => m.key) })),
    transitions,
  };
  console.log(JSON.stringify(report, null, 2));
  writeSummary(report);
  await Promise.all(players.map((p) => p.stop()));
  await host.removeChannel(projector);
  return report;
}

const connectionSamples = [];
let openSockets = 0;
setInterval(() => connectionSamples.push(openSockets), 500).unref();

function startPlayer(i, session) {
  const p = { i, joined: false, ready: false, failed: false, channelLost: false, seen: new Map(), answerMs: [], answerErrors: [], joinError: null, stop: async () => {} };
  (async () => {
    const supabase = client();
    try {
      const { data: auth, error: authErr } = await supabase.auth.signInAnonymously();
      if (authErr) throw new Error(`signIn: ${authErr.message}`);
      anonymousIds.push(auth.user.id);
      const { error: joinErr } = await supabase.rpc("join_session", { p_pin: session.pin, p_nickname: `שחקן ${i + 1}` });
      if (joinErr) throw new Error(`join: ${joinErr.message}`);
      p.joined = true;
      await supabase.realtime.setAuth();
      // Same subscription as the phone (lib/use-live-session.ts).
      const channel = supabase
        .channel(`session:${session.id}`, { config: { broadcast: { replication_ready: true } } })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` }, (payload) => {
          countMessage();
          const row = payload.new;
          const key = `${row.status}:${row.question_idx}`;
          if (!p.seen.has(key)) p.seen.set(key, now());
          if (row.status === "question" && !p.answered?.has(row.question_idx)) {
            (p.answered ??= new Set()).add(row.question_idx);
            void answer(supabase, session.id, p); // like a person: answers after 1–6 s
          }
        })
        .on("system", {}, (payload) => {
          if (payload.extension === "system" && payload.status === "ok") p.ready = true;
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") openSockets++;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (p.ready) p.channelLost = true;
            else p.failed = true;
          }
        });
      p.stop = async () => {
        await supabase.removeChannel(channel);
        openSockets--;
      };
    } catch (e) {
      p.failed = true;
      p.joinError = String(e.message ?? e).replace(/[0-9a-f-]{36}/g, "<id>");
    }
  })();
  return p;
}

async function answer(supabase, sessionId, p) {
  await sleep(1000 + Math.random() * 5000);
  const t0 = now();
  const { error } = await supabase.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: Math.floor(Math.random() * 4) });
  if (error) p.answerErrors.push(error.message);
  else p.answerMs.push(now() - t0);
}

function tally(list) {
  return list.reduce((acc, x) => ({ ...acc, [x]: (acc[x] ?? 0) + 1 }), {});
}

function writeSummary(r) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const rows = r.transitions.map((x) => `| ${x.move} | ${x.state} | ${x.rpcMs} | ${x.reached}/${r.ready} | ${x.p50} | ${x.p95} | ${x.max} |`).join("\n");
  appendFileSync(file, `## Load test: ${r.players} players × ${r.questions} questions

| Metric | Value |
|---|---|
| Joined / listening | ${r.joined} / ${r.ready} (in ${r.joinSeconds} s) |
| Join errors | ${JSON.stringify(r.joinErrors)} |
| Peak Realtime connections | ${r.peakConnections} |
| Peak messages / second (received) | ${r.peakMessagesPerSecond} |
| Answers sent / errors | ${r.answers.sent} / ${JSON.stringify(r.answers.errors)} |
| Answer latency p50 / p95 / max (ms) | ${r.answers.p50} / ${r.answers.p95} / ${r.answers.max} |
| Answers seen by the projector | ${r.projectorAnswersSeen} |
| Dropped players | ${r.dropped} |

### State changes reaching the phones (ms after the host's move)
| Move | State | RPC ms | Reached | p50 | p95 | max |
|---|---|---|---|---|---|---|
${rows}
`);
}

// ── cleanup: always, even after a failure ─────────────────────────────────────────────────────
async function cleanup() {
  let removed = 0;
  for (const id of anonymousIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) removed++;
  }
  if (hostId) await admin.auth.admin.deleteUser(hostId); // cascades: quiz, rounds, questions, session
  console.log(`cleanup: removed ${removed}/${anonymousIds.length} anonymous players and the test host`);
}

let exitCode = 0;
try {
  await main();
} catch (e) {
  console.error("load test failed:", e.message ?? e);
  exitCode = 1;
} finally {
  await cleanup();
  process.exit(exitCode);
}
