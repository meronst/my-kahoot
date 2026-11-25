# ADR 0001 — Stack: TypeScript full-stack (Next.js + Supabase)

Status: accepted, 2026-11-25

## Context
The core of the app is live sync between a projector and up to 150 phones, with game rules that must not be bypassed from the browser. Hosting should be free at this scale. Options per the dev-workflow conventions: (A) TypeScript full-stack, (B) Python backend + JS frontend.

## Decision
**A. TypeScript full-stack:** Next.js (App Router) + Supabase (Postgres, Auth, Realtime, Storage), hosted on Vercel. Tailwind CSS for styling.

## Why
- Supabase Realtime gives live updates without running a WebSocket server.
- Auth for the host (email + password) and participants (anonymous sign-in) is built in.
- Postgres functions + Row Level Security keep game rules and answer keys on the server.
- One language end to end; free hosting.

## Alternatives considered
- **B. FastAPI + React:** needs a long-running server for WebSockets → paid hosting or a cold-starting free tier, and two languages for a small app.

## Consequences
- Cost: $0/month on free tiers; optional domain ~50 ₪/year.
- Supabase Free limits to watch: 200 Realtime connections, **100 messages/s** (a question fan-out to 150 phones is ~150 messages in a burst — load-tested in KQ-12), projects pause after 7 days of inactivity (daily keep-alive in KQ-21), 1 GB storage.
- Fallback if the load test fails: Supabase Pro ($25/month) in months with lectures, or a lower fan-out design. The decision is recorded in a follow-up ADR.
