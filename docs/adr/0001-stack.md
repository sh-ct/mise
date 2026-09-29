# ADR 0001 — Nx + Angular + Supabase TypeScript monorepo

**Status:** Accepted · 2026-09-29

## Context

Portfolio / future-product goal, solo developer with strong Angular + Django experience, $0 hosting,
personal use now and public multi-user later. Wants a mostly-TypeScript stack.

## Decision

- **Nx + pnpm** monorepo — first-class Angular support, caching, enforceable module boundaries.
- **Angular** (signals, standalone, zoneless) — fastest path for the author; built-in PWA support.
- **Supabase** — Postgres (relational, familiar from Django), Auth, Storage, RLS for multi-tenancy, TS edge functions.
- **`packages/core`** holds all domain logic as framework-free TS so it's testable, shared with edge functions, and portable.

## Consequences

- Little backend code to maintain early; RLS policies become the security surface and must be tested.
- Some vendor coupling to Supabase Auth/Storage. Mitigated by plain SQL migrations and domain logic in `core`;
  migration path is a Hono/Nest API on any Postgres.
- Free tier pauses inactive projects and limits storage.

## Alternatives considered

- **Angular + Django** — fastest, but not a TS monorepo and more hosting to run.
- **Neon + Hono on Cloudflare Workers + Better Auth + R2** — more owned backend code; reserved as a fallback.
- **React or SvelteKit frontend** — more to learn at once; not needed for the goals.
