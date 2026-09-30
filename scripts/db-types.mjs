// Regenerate packages/db-types from the local database. Writes only on success, so a failed
// generation (e.g. database not running) never leaves an empty file behind.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const out = 'packages/db-types/src/database.types.ts';
const types = execSync('pnpm exec supabase gen types typescript --local', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (!types.includes('export type Database')) {
  console.error(`supabase gen types returned no types; not writing ${out}`);
  process.exit(1);
}
writeFileSync(out, types);
execSync(`pnpm exec prettier --write ${out}`, { stdio: 'inherit' });
