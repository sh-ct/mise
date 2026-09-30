// Fetching user-supplied URLs server-side without reaching private networks (docs/ARCHITECTURE.md#security).
// Network access is injected so this runs under Vitest as well as Deno.

import {
  checkUrl,
  isBlockedIp,
  isIpLiteral,
  type GuardFailure,
} from './url-guard.ts';

/** An error with the HTTP status and code the function should answer with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface NetworkDeps {
  fetch: typeof fetch;
  /** Resolves to [] when the name has no records of that type; rejects when the lookup itself fails. */
  resolveDns: (
    host: string,
    type: 'A' | 'AAAA',
    options: { signal: AbortSignal },
  ) => Promise<string[]>;
}

const USER_AGENT = 'MiseRecipeImporter/0.1 (+https://github.com/sh-ct/mise)';

export const FETCH_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  timeoutMs: 10_000,
  maxRedirects: 5,
} as const;

export const GUARD_MESSAGES: Record<GuardFailure, string> = {
  'invalid-url': 'That doesn’t look like a web address.',
  'unsupported-scheme': 'Only http and https links can be imported.',
  'credentials-in-url': 'Links with a username or password can’t be imported.',
  'unsupported-port': 'Only standard web ports (80 and 443) are supported.',
  'blocked-address': 'That address isn’t a public website.',
};

/** Parse and shape-check a URL, or throw the matching 400. */
export function assertUrl(raw: string): URL {
  const guard = checkUrl(raw);
  if (!guard.ok)
    throw new HttpError(400, guard.reason, GUARD_MESSAGES[guard.reason]);
  return guard.url;
}

/** Shape checks plus DNS: every address the name resolves to must be public. */
async function assertPublic(
  url: URL,
  deps: NetworkDeps,
  signal: AbortSignal,
): Promise<void> {
  assertUrl(url.href);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIpLiteral(host)) return; // checked by assertUrl
  // Fail closed: if either lookup errors, fetch's own lookup could return the address we didn't see.
  let addresses: string[];
  try {
    addresses = (
      await Promise.all([
        deps.resolveDns(host, 'A', { signal }),
        deps.resolveDns(host, 'AAAA', { signal }),
      ])
    ).flat();
  } catch (e) {
    if (signal.aborted) throw timeoutError();
    console.warn('DNS lookup failed', host, String(e));
    throw new HttpError(
      502,
      'fetch-failed',
      'That website couldn’t be reached.',
    );
  }
  if (addresses.length === 0)
    throw new HttpError(400, 'not-found', 'That website couldn’t be found.');
  if (addresses.some(isBlockedIp))
    throw new HttpError(
      400,
      'blocked-address',
      GUARD_MESSAGES['blocked-address'],
    );
}

const timeoutError = () =>
  new HttpError(504, 'timeout', 'That website took too long to respond.');

/** Map a network failure (while connecting or reading) to a timeout or unreachable error. */
function networkError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof DOMException && e.name === 'TimeoutError')
    return timeoutError();
  return new HttpError(
    502,
    'fetch-failed',
    'That website couldn’t be reached.',
  );
}

/**
 * GET a URL, following redirects by hand so every hop is re-checked against the guards. Returns the
 * final response, which the caller must read or cancel.
 *
 * A hostname can resolve differently between our DNS check and fetch's own lookup (DNS rebinding); the
 * runtime gives no way to pin the address, so this narrows the window rather than closing it.
 */
export async function guardedFetch(
  start: URL,
  deps: NetworkDeps,
  { accept, signal }: { accept: string; signal: AbortSignal },
): Promise<{ response: Response; url: URL }> {
  let url = start;
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
    await assertPublic(url, deps, signal);
    let response: Response;
    try {
      response = await deps.fetch(url, {
        redirect: 'manual',
        signal,
        headers: { 'User-Agent': USER_AGENT, Accept: accept },
      });
    } catch (e) {
      throw networkError(e);
    }
    if (response.status < 300 || response.status >= 400)
      return { response, url };

    const location = response.headers.get('location');
    await response.body?.cancel();
    const broken = new HttpError(
      502,
      'fetch-failed',
      'That website sent a broken redirect.',
    );
    if (!location) throw broken;
    try {
      url = new URL(location, url);
    } catch {
      throw broken;
    }
  }
  throw new HttpError(
    400,
    'too-many-redirects',
    'That link redirects too many times.',
  );
}

/** Read a response body, refusing more than `maxBytes` (after decompression). */
export async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new HttpError(
          413,
          'too-large',
          'That page is too large to import.',
        );
      }
      chunks.push(value);
    }
  } catch (e) {
    throw networkError(e);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return bytes;
}
