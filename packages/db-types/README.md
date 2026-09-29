# @mise/db-types

TypeScript types generated from the Supabase schema. Don't edit `database.types.ts` by hand:
after changing a migration, run `pnpm db:reset` then `pnpm db:types`. CI fails if the file is stale.

Only the app's repository layer imports these; `packages/core` stays database-agnostic.
