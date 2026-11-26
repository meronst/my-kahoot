# ADR 0004 — 150 players fit the Supabase free tier (load test)

Status: accepted, 26/11/2026 · Jira: KQ-12

## Context
The plan expects up to ~150 phones in one lecture. The Supabase free tier lists Realtime limits of
200 concurrent connections and 100 messages per second. Every game state change is one update on the
`sessions` row, which Realtime fans out to every phone: 150 messages at once, above the
100 messages/s figure. Before building further we needed to know if that breaks in practice.

## What we ran
`scripts/load-test.mjs` via `.github/workflows/load-test.yml` (GitHub Actions runner → cloud project),
26/11/2026:
- 150 simulated players, each with its own anonymous login and the same Realtime subscription as the
  phone screen (`lib/use-live-session.ts`), joining at 30 per second
- a simulated host driving 5 questions (start → answers → reveal → 3 s → next) and a simulated
  projector listening to the `answers` feed
- players answer 1–6 s after each question appears, like people do
- a throw-away host owns everything and is deleted at the end (with the quiz, session and the 150
  anonymous users)

## Results
| Metric | Result |
|---|---|
| Joined and listening | 150 / 150, within 5 s |
| Join errors | none |
| Peak Realtime connections (players) | 150 (+1 projector) |
| Peak messages per second received | 168 |
| Answers sent / errors | 750 / 0 |
| Answer call latency p50 / p95 / max | 191 / 251 / 559 ms |
| Answers seen live by the projector | 750 / 750 |
| Dropped players (missed a state or lost the channel) | 0 |
| State change → all 150 phones, p95 | 306–680 ms (worst single phone 757 ms) |

Every one of the 11 state changes reached all 150 phones. The burst above 100 messages/s was
delivered in full. The listed limit is a plan quota, not a hard per-second cut-off, at least at this size.

## Decision
**Go: stay on the free tier.** No Pro plan, no change to the fan-out design.

## Consequences and safety nets
- The phones already re-sync on `visibilitychange`, and the projector polls every 1.5 s
  (KQ-28), so one missed message doesn't freeze a screen.
- Anonymous sign-ins are rate-limited (set to ~500/hour on the dashboard). One lecture of 150 is
  fine; the load test itself uses 150 per run, so don't run it right before a lecture.
- Re-run the test (Actions → load-test → Run workflow) after big Realtime changes, or before a lecture
  much larger than 150. If drops appear: first look at Realtime usage in the dashboard. If needed,
  switch phone updates to a broadcast channel (one message per change), or move to Pro.
- Measured from a GitHub runner; real phones on lecture-hall Wi-Fi will add their own network delay.
