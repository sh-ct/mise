# mise — Product Plan

> Working name. A recipe app for capturing, organising and **cooking from** recipes on phone and desktop.

## Vision

Get any recipe — a blog link, a cookbook photo, a scrawled card, a pasted note — into one clean, structured
library, then cook from it with a focused, hands-free-friendly, step-at-a-time kitchen view.

## Goals & constraints

|                   |                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Primary goal**  | Portfolio-quality codebase that could become a product. Tests, CI, migrations, docs matter. |
| **Users (now)**   | Just the author.                                                                            |
| **Users (later)** | Public, multi-user. Every table is owner-scoped with row-level security from day one.       |
| **Budget**        | $0 hosting to start (free tiers). No paid AI until a later phase.                           |
| **Platforms**     | Installable PWA; phone-first cook mode, desktop-friendly library and editor.                |
| **Offline**       | Read offline (opened/pinned recipes + images). Editing requires a connection.               |
| **Units**         | Mixed — each recipe keeps its original units; convert on demand.                            |
| **Existing data** | None — starting fresh, no migration importer needed.                                        |

## Features by area

### Capture

- **Manual editor** — sections ("For the sauce"), structured ingredients (qty / unit / item / prep note), steps, step↔ingredient links, photos.
- **URL import** — extract schema.org `Recipe` JSON-LD; fall back to heuristics.
- **Paste text** — heuristic parser splits ingredients from method.
- **Photo / scan** — keep the original scan; OCR in-browser (Tesseract.js) → same text parser.
- All imports produce a **draft** that opens in the editor for review before saving.
- AI parsing (free tier → paid / bring-your-own-key) is a later phase.

### Organise & find

- Tags (typed: cuisine, course, diet, custom), collections (many-to-many), full-text search incl. ingredients.
- Per-user rating, favourite, private notes, "cooked it" log.

### Cook mode

- One step at a time (mobile shows only the current step, large text), with a **next-step preview** listing the ingredients and amounts it needs.
- Tap / swipe forward and back; tick off ingredients and steps.
- Timers auto-detected in step text — tap to start a countdown; multiple timers in a persistent bar;
  ranges start at the lower bound with a "check now" prompt; +1/+2/+5 min extend, even after expiry.
  Alerts in-app only (screen kept awake via Wake Lock API).
- Scale servings; convert units.
- Glossary (add-on): terms from a curated global glossary auto-underlined on first mention per step — tap for an explanation.
- **Voice (no AI):** read steps aloud (SpeechSynthesis) and simple commands — "next", "back", "repeat", "ingredients" (SpeechRecognition, where supported). Tap always works as fallback.
- **Voice (AI, later):** conversational assistant — ask questions, get advice, say "done" to advance.
- **Step text is the hero.** The glossary definition appears only when the word is tapped; the next step is a
  one-line footnote.
- **Big type** setting: step text ~40% larger, next-step footnote hidden.
- **Stand mode** (landscape phone, tablet, desktop): step on the left, its ingredients (and photo) on the right.
- **Step photos** (optional per step): on phones, a round camera button between Back and Next — only on steps
  with a photo — opens the photo in a sheet over the lower half. Stand mode shows it beside the step.

### Look and feel

- Design tokens for everything; components use only tokens (ADR 0007). Themes are light/dark pairs.
- Default theme: **Bento** (light and dark). Market Stall, Night Kitchen, Enamel and Order Ticket are kept as
  alternative themes (`docs/design/style-directions.html`) and selectable under Settings → Style.
- Appearance: always light, always dark, auto by time of day (dark 7pm–7am), or auto by device theme (default).
- Mobile first; tablets and desktop get a sidebar and wider layouts. Library keeps recipe photos.

### Later

- Shopping list from recipes (ingredients modelled for this now), meal planner.
- Public profiles, sharing (only user-authored recipes public — see copyright note).
- "Teach me" mode for recipes and techniques, built on steps + glossary.
- Google OAuth, passkeys.
- Background timer alerts via scheduled Web Push.

## Ideas parking lot

- **Simplify mode** — for beginners, rewrite jargon into plain instructions ("reduce" → "simmer uncovered
  until it thickens"). Glossary entries carry a `plain_phrasing`; clean in-sentence rewriting likely needs AI (Phase 5).

## Roadmap

Each phase ends deployed and usable.

### Phase 0 — Foundations

- Public GitHub repo, protected `main`, commitlint.
- Nx + pnpm workspace; Angular app with Tailwind + spartan/ui; `packages/core`; Supabase CLI local stack.
- Spikes: Signal Forms stability; Deno edge function importing `packages/core`.
- Auth (email OTP code + magic link), owner-scoped RLS pattern, first migration, first pgTAP test.
- CI: lint, typecheck, Vitest, pgTAP, Playwright, build; Cloudflare Pages PR previews; migrations to prod on merge.
- Installable empty PWA shell.
- **Done when:** I can sign in on my phone to an installed PWA, deployed from `main` by Cloudflare Pages
  ([hosted setup](SETUP.md)).

### Phase 1 — Library

- Recipe CRUD with the full structured editor (sections, ingredients, steps, step↔ingredient links),
  saved atomically via the `save_recipe` RPC.
- Hero + optional step photos (resized to WebP 400/1600 in-browser before upload).
- Tags, collections, full-text search, ratings/favourites/notes, cooked log.
- **Done when:** I can enter 10 real recipes by hand and find any of them in two taps or one search.

### Phase 2 — Cook mode

- Step-focus view, next-step preview with ingredients, tap/swipe nav, tick-off, timers, wake lock.
- Serving scaling and unit conversion (volume↔volume, mass↔mass; small density table for common volume↔mass).
- Offline read: cache opened + pinned recipes and images.
- **Done when:** I cook a full recipe from my phone without touching the screen more than once per step, including with Wi-Fi off.

### Phase 3 — Import (no AI)

- URL import via edge function (JSON-LD → draft).
- Paste-text parser; ingredient-line parser; auto-link ingredients to steps.
- Scan upload + stored original + Tesseract.js OCR → text parser.
- **Done when:** the fixture set (see Test corpus) imports with ≤ 2 manual corrections each.

### Phase 4 — Voice & glossary

- Read-aloud, voice commands.
- Glossary: curated seed terms, render-time matching with context rules, tooltips, per-step suppress toggle in the editor.

### Phase 5 — AI

- Pluggable parser interface; free-tier LLM provider; then paid / bring-your-own-key.
- Conversational cook assistant; AI glossary explanations.

### Phase 6 — Public

- Multi-user onboarding, sharing/visibility, shopping list, meal planner, teach mode.

## Test corpus

Collect real inputs to use as fixtures in `packages/core` tests:

- [ ] 5+ recipe URLs from different sites (incl. one with no JSON-LD)
- [ ] 3+ cookbook page photos
- [ ] 2+ handwritten cards
- [ ] 3+ pasted free-text recipes (notes app, messages, email)

## Notes & risks

- **Copyright:** importing for personal use is fine; when public, only user-authored recipes can be made public. Ingredient lists generally aren't protected; a site's method text is.
- **Supabase free tier** pauses inactive projects (~1 week) and has limited storage — compress images, check current limits at setup.
- **Speech recognition** is uneven across browsers (none in Firefox, variable on iOS Safari) — voice is always progressive enhancement.
- **Ingredient parsing** is the hardest non-AI problem; keep `raw_text` on every ingredient so nothing is lost.

## Open questions

- Glossary seed content: write our own vs an openly licensed source.
- Final product name.

## Resolved (2026-09-29)

UI kit → Tailwind + spartan/ui · Auth → email OTP/magic link first, Google + passkeys later ·
Forms → Signal Forms if stable, else Reactive · State → NgRx SignalStore · Rendering → client-only SPA ·
Testing → Vitest + Playwright + pgTAP · Hosting → Cloudflare Pages · Data access → reads via client, writes via RPC ·
Images → browser-resized WebP · Envs → local + prod · Workflow → public repo, PRs, conventional commits ·
Step markup → none; timers & glossary detected at render time.

## Resolved (2026-09-30)

Theme → Bento light/dark by default (was Market Stall), all five directions kept · Tokens → every visual value is a token; Tailwind
wired at theme level; enforced by `nx run web:tokens` · Appearance → light / dark / time / device · Cook mode →
big type, stand mode, step photos behind a nav-row camera button · Library photos → kept.
