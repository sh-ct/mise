# mise — Architecture

## Stack

| Layer         | Choice                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Monorepo      | Nx + pnpm                                                                                            |
| Frontend      | Angular (standalone, signals, zoneless), client-only SPA + `@angular/service-worker` (PWA)           |
| UI            | Tailwind CSS + spartan/ui (headless primitives, owned component code), Angular CDK (drag-drop)       |
| State         | NgRx SignalStore — one store per feature (library, editor draft, cook session)                       |
| Forms         | Angular Signal Forms (stable in Angular 22); Zod for domain validation                               |
| Backend       | Supabase — Postgres, Auth, Storage, Edge Functions (Deno / TypeScript)                               |
| Auth          | Email 6-digit code + sign-in link (Phase 0); Google OAuth and passkeys later                         |
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
│        ├─ core/          auth, supabase client, repositories, theme, offline cache
│        ├─ layout/        signed-in shell (nav bars); signed-out pages bring their own frame
│        ├─ features/
│        │  ├─ auth/       sign-in (code), email-link confirm
│        │  ├─ library/    list, search, tags, collections
│        │  ├─ recipe/     view + editor
│        │  ├─ cook/       cook mode, voice, timers
│        │  └─ import/     url / text / scan flows → draft → editor
│        └─ shared/        ui components, pipes (quantity, fraction)
├─ packages/
│  ├─ core/                domain logic — no Angular, no Supabase, no DOM
│  │  ├─ schema/           Zod: Recipe, RecipeDraft, Ingredient, Step…
│  │  ├─ ingredients/      ingredient-line parser, formatting, fractions
│  │  ├─ units/            unit registry, conversion, density table
│  │  ├─ scaling/
│  │  ├─ steps/            step markup parser (timers, glossary), ingredient auto-linking
│  │  └─ import/           JSON-LD mapper, free-text splitter
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

All user-owned rows carry `owner_id` and RLS `owner_id = auth.uid()`. Child tables (sections, ingredients,
steps, links, tags, collection entries) repeat `owner_id` and reference their parent by `(id, owner_id)`, so a
child can never belong to a different user than its parent and every policy is a plain column comparison.
Ingredients and steps also reference their section by `(section_id, recipe_id, kind)`, and step↔ingredient
links by `(…, recipe_id)`, so cross-recipe or wrong-kind references are rejected by the database.
Schema: `supabase/migrations`; tests: `supabase/tests/database` (pgTAP).

```
recipe
  id (client-generated), owner_id, title, description,
  servings numeric, yield_text,
  prep_minutes, cook_minutes, total_minutes,
  source_type  (manual | url | text | scan | ai),
  source_url, source_attribution,
  unit_system  (metric | us | mixed),
  hero_image_path,                              -- must start with {owner_id}/
  visibility   (private | unlisted | public)   -- private only until Phase 6
  search tsvector                               -- title, description, ingredient items, tags
  created_at, updated_at                        -- set by trigger, never by clients

recipe_section        id, owner_id, recipe_id, kind (ingredients | steps), title?, position
ingredient            id, owner_id, recipe_id, section_id, section_kind, position,
                      qty_min numeric?, qty_max numeric?,   -- ranges: "2–3 cloves"
                      unit text?,                            -- canonical code from core/units
                      item text, prep_note text?, note text?, -- "onion", "finely diced", "14 oz can"
                      optional bool, raw_text text           -- original line, never lost
step                  id, owner_id, recipe_id, section_id, section_kind, position,
                      text (plain prose), image_path?,
                      glossary_suppress text[]               -- slugs NOT to link in this step
step_ingredient       owner_id, recipe_id, step_id, ingredient_id, amount_fraction numeric default 1
source_asset          id, owner_id, recipe_id, storage_path, kind (scan | photo), ocr_text?
tag                   id, owner_id, kind (cuisine | course | diet | custom), name   -- unique per owner, case-insensitive
recipe_tag            owner_id, recipe_id, tag_id
collection            id, owner_id, name, description?, cover_image_path?
collection_recipe     owner_id, collection_id, recipe_id, position
user_recipe_meta      user_id, recipe_id, rating, favourite, notes   -- per user, survives going public
cook_log              id, user_id, recipe_id, cooked_at, notes
glossary_term         id, slug, term, aliases text[], definition,
                      match_rules jsonb,          -- { requireNear?, excludeNear?, window? } (core GlossaryMatchRules)
                      plain_phrasing text?        -- future "simplify" mode
                      -- global, curated by us, read-only to users

Not yet: canonical_ingredient_id on ingredient (shopping-list merging, later phase).
```

Search: trigger-maintained `recipe.search` (ingredients live in another table, so a generated column won't
do), GIN index, plus `pg_trgm` for fuzzy title matching. Statement-level triggers on `ingredient`,
`recipe_tag` and `tag` re-index affected recipes; a re-index alone doesn't bump `updated_at`, so tagging
doesn't reorder "recently updated".

Size limits (text lengths, counts, servings, minutes) are check constraints that mirror `LIMITS` in
`packages/core/src/schema/recipe.ts`, so a draft that validates in the editor always saves.

Internal SQL helpers live in a `private` schema, which PostgREST doesn't expose. API roles have no TRUNCATE,
and `anon` can only read the glossary (including for tables created later, via default privileges).

`save_recipe` replaces sections, ingredients, steps and links wholesale, so **nothing may hold foreign keys to
ingredient or step ids** — a future shopping list or cook-progress record stores its own copy. Copying a
recipe (e.g. from a shared one) must generate new ids, since child ids are globally unique.

Tags are embedded through the junction: `recipe?select=*,recipe_tag(tag(name))`.

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
- Stores (NgRx SignalStore) call repositories; components never touch supabase-js directly. Lint enforces it:
  only `*.repository.ts` and `core/supabase` may import supabase-js values or the `SUPABASE` client token.

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

- Angular service worker (production builds, `apps/web/ngsw-config.json`): the app shell is prefetched, icons
  and fonts cached on first use; image `dataGroups` with a size cap come with offline recipes. A new version
  downloads in the background and a toast offers "Update now" or "Later"; the user picks the moment
  (`AppUpdateStore`, started at boot). Cook mode should hide the toast when it arrives.
- Installable: `public/manifest.webmanifest` plus home-screen meta tags in `index.html`, guarded by
  `manifest.spec.ts`. Icons are rendered from `apps/web/icons/icon.svg` by `pnpm icons`. The splash screen uses
  the icon's tile colour, so dark-mode users don't get a white flash; `theme-boot.js` sets `theme-color` before
  Angular starts.
- Rolling back a bad deploy: deploy `node_modules/@angular/service-worker/safety-worker.js` as
  `ngsw-worker.js`. It unregisters the worker and clears its caches on every client; then deploy a fixed
  build. (Deleting `ngsw.json` doesn't work on Cloudflare Pages: its SPA fallback serves `index.html` instead of
  a 404.)
- Bundle: supabase-js is needed at startup by the route guards, so the initial warning budget is 800 kB (the
  error budget stays 1 MB).
- When offline data (Dexie recipes, cached images) arrives, signing out must clear it, for shared devices.
- Recipe data: repositories read-through to Dexie; recently opened + explicitly **pinned** recipes kept.
- Offline edits are disabled with a clear banner. See [ADR 0003](adr/0003-offline-read.md).
- Auth offline: if the access token has expired, supabase-js can't refresh it offline and reports no session,
  so the app shows sign-in; the sign-in page moves on by itself once the refresh succeeds. Phase 2 must let
  offline reading work from the stored session instead.

## Auth

- Supabase email auth sending **both a 6-digit OTP code and a sign-in link**. The code matters for the installed
  iOS PWA: links open in Safari, which doesn't share storage with the home-screen app.
- Flow (`features/auth`): `/sign-in` sends a code (`signInWithOtp`, `shouldCreateUser: false`) and verifies it
  (`verifyOtp`, auto-submitted on the sixth digit), then returns to the `next` page (same-origin paths only).
  The email link goes to `/auth/confirm?token_hash=…`, which signs in only after a tap, so email scanners that
  open links can't spend the one-time token. Unknown addresses get the same "if it has an account" reply, so the
  form can't be used to find out who has an account.
- `AuthStore` follows Supabase's session (including other tabs); route guards wait for the saved session to
  load, and the signed-in shell returns to `/sign-in` whenever the session ends.
- **Invite-only** while personal: sign-up is disabled and email confirmation required (open sign-up would let
  anyone pre-register someone else's address). Add users from the dashboard; locally, `supabase/seed.sql`
  creates `dev@mise.test` (codes arrive in Mailpit at http://127.0.0.1:54324).
- The hosted project must get the same settings as `supabase/config.toml`: sign-up off, confirmations on,
  the `templates/magic-link.html` email (code + link to `{{ .SiteURL }}/auth/confirm`), 10-minute OTP expiry,
  60 s resend interval, site URL and redirect URLs. The local config raises the hourly email limit for e2e only.
- The app's Supabase URL and publishable key live in `apps/web/src/environments/` (development: the local
  stack; production: filled in once the hosted project exists).
- Free-tier built-in email is rate-limited — configure custom SMTP (e.g. Resend free tier) before going public.
- Known limits, to fix before going public:
  - The UI gives unknown addresses the same reply, but GoTrue's API still answers differently (and only real
    accounts hit the per-address resend limit), so account existence can be probed. Add captcha (Cloudflare
    Turnstile: `captchaToken` in `signInWithOtp`, plus CSP entries) with custom SMTP; it also stops strangers
    using up a user's email quota.
  - Pin the CSP's `https://*.supabase.co` entries to the project's own host once it exists.
- Never `supabase config push` from this repo: `config.toml` holds local values (localhost URLs, raised e2e
  rate limits). Hosted auth settings are set in the dashboard.
- Google OAuth and passkeys later.

## Security

- RLS on every table; pgTAP tests assert user A cannot read or write user B's rows.
- Storage buckets use owner-prefixed paths (`{owner_id}/…`) with matching storage policies.
- The edge function fetching URLs validates scheme, blocks private IP ranges (SSRF), caps response size and timeout.
- Response headers (CSP, nosniff, referrer and permissions policies) are in `apps/web/public/_headers` for
  Cloudflare Pages. The CSP allows only same-origin scripts and fonts plus Supabase for data and images.
  Keep Cloudflare's HTML rewriting (Web Analytics auto-injection, email obfuscation, etc.) off: it would be
  blocked by the CSP and would break the service worker's hash check, so updates would never install.
- No secrets in the frontend beyond the Supabase anon key. The repo is public — secrets live only in
  GitHub Actions / Cloudflare / Supabase settings.

## Delivery

- PR per feature into protected `main`; required checks: lint, typecheck, unit, pgTAP, e2e, build.
- Conventional commits enforced by commitlint.
- Cloudflare Pages builds a preview per PR; merge to `main` deploys prod and CI applies Supabase migrations
  (`supabase db push`) to the prod project.
- E2E runs in CI against a local Supabase stack, never prod. A `setup` project signs one user in through the
  email-link page and saves the session for the device projects; sign-in tests create their own users through
  the admin API and read codes from Mailpit.
