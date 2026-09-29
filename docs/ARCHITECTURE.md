# mise — Architecture

## Stack

| Layer         | Choice                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Monorepo      | Nx + pnpm                                                                                            |
| Frontend      | Angular (standalone, signals, zoneless), client-only SPA + `@angular/service-worker` (PWA)           |
| UI            | Tailwind CSS + spartan/ui (headless primitives, owned component code), Angular CDK (drag-drop)       |
| State         | NgRx SignalStore — one store per feature (library, editor draft, cook session)                       |
| Forms         | Signal Forms if stable at scaffold time, else typed Reactive Forms; Zod for domain validation        |
| Backend       | Supabase — Postgres, Auth, Storage, Edge Functions (Deno / TypeScript)                               |
| Auth          | Email OTP code + magic link (Phase 0); Google OAuth and passkeys later                               |
| Shared domain | `packages/core` — pure, framework-free TypeScript + Zod                                              |
| DB types      | Generated with `supabase gen types typescript`                                                       |
| Offline data  | IndexedDB (Dexie) behind a repository layer                                                          |
| Testing       | Vitest (core, components), Playwright (e2e, mobile + desktop viewports), pgTAP (RLS & RPCs)          |
| Hosting       | Cloudflare Pages (frontend, PR previews), Supabase free tier                                         |
| Environments  | Local (Supabase CLI / Docker) + prod. Staging added when going public.                               |
| CI / workflow | GitHub Actions; public repo; PR per feature into protected `main`; conventional commits (commitlint) |

Rationale: [ADR 0001](adr/0001-stack.md), [ADR 0006](adr/0006-frontend-and-tooling.md).

## Repository layout

```
mise/
├─ apps/
│  └─ web/                 Angular PWA
│     └─ src/app/
│        ├─ core/          auth, supabase client, repositories, offline cache
│        ├─ features/
│        │  ├─ library/    list, search, tags, collections
│        │  ├─ recipe/     view + editor
│        │  ├─ cook/       cook mode, voice, timers
│        │  └─ import/     url / text / scan flows → draft → editor
│        └─ shared/        ui components, pipes (quantity, fraction)
├─ packages/
│  ├─ core/                domain logic — no Angular, no Supabase, no DOM
│  │  ├─ schema/           Zod RecipeDraft + LIMITS shared with the DB
│  │  ├─ quantity/         number parsing ("1½", "1-1/2", ranges), kitchen-fraction formatting
│  │  ├─ units/            unit registry, conversion, density table
│  │  ├─ ingredients/      ingredient-line parser, display formatting, unit-system detection
│  │  ├─ scaling/
│  │  ├─ steps/            timer + glossary detection, enrichment segments, ingredient auto-linking
│  │  ├─ cook/             timer model, step ingredient preview
│  │  ├─ import/           JSON-LD mapper, plain-text splitter, HTML fallback, RecipeParser
│  │  └─ text/             shared text helpers (bullets, list numbers, plurals, spans)
│  └─ db-types/            generated Supabase types
├─ supabase/
│  ├─ migrations/          plain SQL, source of truth for schema
│  ├─ functions/
│  │  └─ import-url/       fetch page → JSON-LD → RecipeDraft
│  ├─ tests/               RLS / SQL tests
│  └─ seed.sql
└─ docs/
```

**Boundary rule (Nx tags):** `apps/*` may depend on `packages/*`; `packages/core` depends on nothing but Zod.
Edge functions import `packages/core` so parsing logic is shared client/server — needs a Phase 0 spike to
confirm the Deno import setup.

## Data model

All user-owned rows carry `owner_id uuid references auth.users` and RLS `owner_id = auth.uid()`.

```
recipe
  id, owner_id, title, description,
  servings numeric, yield_text,
  prep_min, cook_min, total_min,
  source_type  (manual | url | text | scan | ai),
  source_url, source_attribution,
  unit_system  (metric | us | mixed),
  hero_image_path,
  visibility   (private | unlisted | public)   -- private only until Phase 6
  search tsvector                               -- title, description, ingredient items, tags
  created_at, updated_at

recipe_section        id, recipe_id, kind (ingredients | steps), title, position
ingredient            id, recipe_id, section_id?, position,
                      qty_min numeric?, qty_max numeric?,   -- ranges: "2–3 cloves"
                      unit text?,                            -- canonical code from core/units
                      item text, prep_note text?, note text?, -- "onion", "finely diced", "14 oz can"
                      optional bool, raw_text text,          -- original line, never lost
                      canonical_ingredient_id?               -- later: shopping list merge
step                  id, recipe_id, section_id?, position, text (plain prose), image_path?,
                      glossary_suppress text[]               -- slugs NOT to link in this step
step_ingredient       step_id, ingredient_id, amount_fraction numeric default 1
source_asset          id, recipe_id, storage_path, kind (scan | photo), ocr_text?
tag                   id, owner_id, kind (cuisine | course | diet | custom), name
recipe_tag            recipe_id, tag_id
collection            id, owner_id, name, description, cover_image_path?
collection_recipe     collection_id, recipe_id, position
user_recipe_meta      user_id, recipe_id, rating, favourite, notes   -- per user, survives going public
cook_log              id, user_id, recipe_id, cooked_at, notes
glossary_term         id, slug, term, aliases text[], definition,
                      match_rules jsonb,          -- { requireNear?: string[], excludeNear?: string[] }
                      plain_phrasing text?        -- future "simplify" mode
                      -- global, curated by us, read-only to users
```

Search: trigger-maintained `recipe.search` (ingredients live in another table, so a generated column won't
do), GIN index; add `pg_trgm` for fuzzy title matching.

Images: stored under `{owner_id}/{recipe_id}/{uuid}` with `-400.webp` and `-1600.webp` variants generated in
the browser before upload; `*_image_path` columns store the base key. Original scans are kept as compressed JPEG.

## Step text — plain prose, enriched at render time

Step text is stored as plain prose with **no markup**. `packages/core/steps` annotates it at render time:

- **Timers** — durations are detected ("25 minutes", "1 hr 15", "10–12 mins") and rendered as tappable chips.
- **Glossary** — terms and aliases from the global `glossary_term` table are matched (case-insensitive, word
  boundary, longest match first), filtered by each term's `match_rules` (e.g. "reduce" excluded before "heat")
  and the step's `glossary_suppress` list, and the **first mention per step** is underlined with a tooltip.
  Adding a term lights it up across every recipe with no data migration. Glossary is an add-on, not core.

Ingredient references are **not** inline — they are rows in `step_ingredient`, so scaling and the
next-step preview work from structured data. Auto-linking at import fuzzy-matches ingredient `item`s
in step text; the editor lets you fix links. See [ADR 0002](adr/0002-structured-recipes.md) and
[ADR 0005](adr/0005-render-time-enrichment.md).

Step editor: textarea with a live rendered preview (showing detected timers and glossary terms, with a toggle
to suppress a glossary match for that step).

## Key flows

### Import pipeline

```
URL  ──► edge fn import-url ──► JSON-LD mapper ─┐
Text ──────────────────────────► text splitter ──┼──► RecipeDraft (Zod) ──► editor (review) ──► save
Scan ──► storage + Tesseract.js ► text splitter ─┘            ▲
                                                auto-link step↔ingredient
```

Every source produces the same `RecipeDraft`. Nothing is saved without human review.
AI parsers (Phase 5) plug in as another `RecipeParser` implementation. See [ADR 0004](adr/0004-ai-later.md).

### Data access

- **Reads:** repository services use supabase-js nested selects, validated/mapped into `core` types.
- **Writes:** a Postgres function `save_recipe(draft jsonb)` (RPC) validates ownership and writes recipe,
  sections, ingredients, steps and links in **one transaction**. The client validates with Zod first; the DB
  function enforces constraints. pgTAP tests cover it.
- Stores (NgRx SignalStore) call repositories; components never touch supabase-js directly.

### Cook mode

State is a SignalStore: current step index, ticked ingredients/steps, active timers, scale factor, unit
preference. It's client-only and persisted to IndexedDB so a reload mid-cook resumes. Input sources
(tap, swipe, keyboard, voice commands, later AI assistant) all dispatch the same actions:
`next | prev | repeat | showIngredients | startTimer | extendTimer`.

**Timers**

- Stored as absolute `endsAt` timestamps, so countdowns are correct after the tab is suspended or the screen locks.
- Multiple concurrent timers in a persistent bar visible on every step.
- Ranges ("10–12 min") start at the **lower bound** with a "check now" prompt.
- Extend buttons (+1 / +2 / +5 min) are available while running **and after expiry**.
- Alerts (sound, vibration, notification) fire **in-app only**; Wake Lock keeps the screen on while cooking.
  Background alerts via scheduled Web Push are a possible later phase.

### Offline read

- Angular service worker: app shell + static assets; image `dataGroups` with a size cap.
- Recipe data: repositories read-through to Dexie; recently opened + explicitly **pinned** recipes kept.
- Offline edits are disabled with a clear banner. See [ADR 0003](adr/0003-offline-read.md).

## Auth

- Supabase email auth sending **both a 6-digit OTP code and a magic link**. The code matters for the installed
  iOS PWA: magic links open in Safari, which doesn't share storage with the home-screen app.
- Free-tier built-in email is rate-limited — configure custom SMTP (e.g. Resend free tier) before going public.
- Google OAuth and passkeys later.

## Security

- RLS on every table; pgTAP tests assert user A cannot read or write user B's rows.
- Storage buckets use owner-prefixed paths (`{owner_id}/…`) with matching storage policies.
- Recipe text from imports is untrusted: render it with text bindings or `StepSegment`s, never `[innerHTML]`.
- The URL-import edge function (not built yet) must:
  - require a user JWT and rate-limit per user, so it can't be used as an open proxy;
  - allow http(s) on ports 80/443 only, no credentials in the URL; resolve DNS and block loopback, private,
    link-local, metadata, IPv6 ULA and IPv4-mapped addresses; follow redirects manually, re-checking each hop;
  - stream the response with a byte cap (~2 MB), a timeout, and a text/html content-type check;
  - pass the final post-redirect URL as `sourceUrl` (not the page's own claim), wrap parsing in a time budget,
    and return only the validated draft;
  - treat `heroImageUrl` as attacker-chosen: the client uploads it through the same guarded fetch, never
    hotlinks it (which would leak the user's IP to the page owner).
- `packages/core` importers are linear-time on hostile input and clip everything to `LIMITS`, so the
  function's own caps are defence in depth.
- No secrets in the frontend beyond the Supabase anon key. The repo is public — secrets live only in
  GitHub Actions / Cloudflare / Supabase settings.

## Delivery

- PR per feature into protected `main`; required checks: lint, typecheck, unit, pgTAP, e2e, build.
- Conventional commits enforced by commitlint.
- Cloudflare Pages builds a preview per PR; merge to `main` deploys prod and CI applies Supabase migrations
  (`supabase db push`) to the prod project.
- E2E runs in CI against a local Supabase stack, never prod.
