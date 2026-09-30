# mise

Recipe PWA — capture (manual / URL / text / scan), organise, and cook step-by-step. Working name.

- Plan & roadmap: `docs/PLAN.md` · Architecture & data model: `docs/ARCHITECTURE.md` · Decisions: `docs/adr/`
- Stack: Nx + pnpm, Angular (signals, standalone, zoneless, client-only SPA), Tailwind + spartan/ui, NgRx SignalStore,
  Supabase (Postgres/Auth/Storage/Edge Functions), Zod. Tests: Vitest, Playwright, pgTAP. Hosting: Cloudflare Pages.

## Conventions

- Components never call supabase-js directly: component → SignalStore → repository. Multi-table writes go through Postgres RPCs (e.g. `save_recipe`).
- Step text is plain prose — timers and glossary terms are detected at render time in `packages/core/steps`; don't add markup.
- Conventional commits; one PR per feature.
- Domain logic lives in `packages/core` — pure TS, no Angular/Supabase/DOM imports. Test it with Vitest using the fixture corpus.
- Schema changes are SQL migrations in `supabase/migrations`; regenerate `packages/db-types` after each (`pnpm db:types`).
- Every user-owned table has `owner_id` + RLS; add an RLS test with every new table.
- Every import path produces a `RecipeDraft` that opens in the editor — never save parsed data directly.
- Ingredients always keep `raw_text`.
- Voice and AI are progressive enhancements; tap navigation must always work.
- UI uses design tokens only (ADR 0007): Tailwind token utilities (`bg-canvas`, `text-ink`, `rounded-card`, `heading`, …),
  never literal colours, fonts, radii or shadows. Literal values live only in `apps/web/src/styles/themes`. New visual
  needs get a new token defined in every theme. `pnpm tokens` enforces this.
- Mobile first, but every screen must work on tablet and desktop; e2e runs on desktop, Android and iPhone viewports.

## Commands

- `pnpm nx serve web` — dev server · `pnpm test` / `pnpm lint` / `pnpm typecheck` / `pnpm build` — all projects
- `pnpm nx test core` — core unit tests · `pnpm nx e2e web-e2e` — Playwright (desktop, Android, iPhone, iPad, landscape phone; needs `pnpm db:start`) · `pnpm tokens` — design token check
- `pnpm format` before committing.
- `pnpm icons` — re-render the PWA icons after changing `apps/web/icons/icon.svg`.
- Database (needs Docker): `pnpm db:start`, `pnpm db:reset` (re-applies migrations + seed), `pnpm db:test` (pgTAP), `pnpm db:types` (regenerate `packages/db-types` after any migration change).
- pnpm blocks dependency install scripts by default: approve new ones with `pnpm approve-builds <pkg>` (recorded in `pnpm-workspace.yaml`).
- Nx plugins/generators: always pass `--no-interactive`; if Nx hangs on Windows, run with `NX_DAEMON=false`.
- TypeScript 6: `paths` in `tsconfig.base.json` must start with `./` (no `baseUrl`).
