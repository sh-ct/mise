import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Angular test runner starts in the workspace root; a direct Vitest run starts in apps/web.
const WEB = existsSync('apps/web') ? 'apps/web' : '.';

/** A file from apps/web, for specs that check config and assets against the code. */
export function readWebFile(path: string): Buffer {
  return readFileSync(join(WEB, path));
}

export function readWebText(path: string): string {
  return readWebFile(path).toString('utf8');
}
