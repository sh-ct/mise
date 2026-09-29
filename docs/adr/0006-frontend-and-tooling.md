# ADR 0006 — Frontend architecture, data access and tooling

**Status:** Accepted · 2026-09-29

## Decisions

| Area        | Decision                                                            | Why                                                                                              |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| UI          | Tailwind + spartan/ui                                               | Headless, accessible primitives with owned component code; distinctive design.                   |
| State       | NgRx SignalStore, one store per feature                             | Signal-native, lightweight, recognisable pattern.                                                |
| Forms       | Signal Forms if stable at scaffold time, else typed Reactive Forms  | Best fit for a signals app without betting on experimental APIs.                                 |
| Rendering   | Client-only SPA                                                     | Private app; static hosting; SSR/prerender or share-preview function added in Phase 6 if needed. |
| Data access | Reads via supabase-js; writes via `save_recipe(jsonb)` Postgres RPC | Multi-table saves must be atomic; supabase-js has no client transactions.                        |
| Images      | Resize to WebP 400/1600 in-browser; keep scan originals             | Supabase image transforms are a paid feature.                                                    |
| Testing     | Vitest, Playwright (mobile + desktop), pgTAP                        | RLS and RPCs are the backend; they need tests.                                                   |
| Hosting     | Cloudflare Pages                                                    | Free, PR previews, commercial use allowed, Workers available later.                              |
| Envs        | Local + prod; staging when going public                             | Keep ops minimal while single-user.                                                              |
| Workflow    | Public repo, PR per feature, protected main, conventional commits   | Portfolio-quality history.                                                                       |
| Auth        | Email OTP code + magic link; Google + passkeys later                | OTP code is needed for installed iOS PWAs.                                                       |
