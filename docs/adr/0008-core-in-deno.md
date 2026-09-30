# ADR 0008 — packages/core runs unchanged in Supabase edge functions

**Status:** Accepted · 2026-09-30

## Context

The URL importer runs server-side in a Supabase edge function (Deno), using the same parsing code as the
app. Deno resolves only explicit module paths; the edge runtime ignores the "sloppy imports" option, so
`import … from './ids'` fails there (verified in a spike).

## Decision

- Relative imports inside `packages/core` include the `.ts` extension (`'./ids.ts'`).
- `tsconfig.base.json` sets `allowImportingTsExtensions` with `rewriteRelativeImportExtensions`, which Angular's
  build, Vitest and `tsc` all accept.
- Edge functions import `@mise/core`, the same alias the app uses; each function's `deno.json` maps it to
  `../../../packages/core/src/index.ts` and maps npm packages (`"zod": "npm:zod@<version in package.json>"`).
- CI type-checks each function with `deno check`.

## Consequences

- No bundling step or generated copy of core; one source for browser and server.
- New core files must use `.ts` extensions on relative imports. The zod version in each function's `deno.json`
  must match `package.json`.
