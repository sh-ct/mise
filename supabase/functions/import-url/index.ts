// import-url: fetch a recipe page server-side and turn it into a RecipeDraft for the editor
// (docs/ARCHITECTURE.md#import-pipeline, #security).
//
// POST { "url": "https://…" } with the user's JWT → 200 { "draft": RecipeDraft }
// Errors → { "error": { "code": string, "message": string } } with a matching HTTP status.

import {
  RecipeDraftSchema,
  htmlParser,
} from '@mise/core';
import {
  IMPORT_LIMITS,
  checkUrl,
  isBlockedIp,
  isHtml,
  type GuardFailure,
} from '../_shared/url-guard.ts';

const USER_AGENT = 'MiseRecipeImporter/0.1 (+https://github.com/sh-ct/mise)';
const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:4200'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

class ImportError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const GUARD_MESSAGES: Record<GuardFailure, string> = {
  'invalid-url': 'That doesn’t look like a web address.',
  'unsupported-scheme': 'Only http and https links can be imported.',
  'credentials-in-url': 'Links with a username or password can’t be imported.',
  'unsupported-port': 'Only standard web ports (80 and 443) are supported.',
  'blocked-address': 'That address isn’t a public website.',
};

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : (ALLOWED_ORIGINS[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Shape checks plus DNS: every address the name resolves to must be public. */
async function assertPublic(url: URL): Promise<void> {
  const guard = checkUrl(url.href);
  if (!guard.ok)
    throw new ImportError(400, guard.reason, GUARD_MESSAGES[guard.reason]);

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(host) || host.includes(':')) return; // IP literal, already checked
  const records = await Promise.allSettled([
    Deno.resolveDns(host, 'A'),
    Deno.resolveDns(host, 'AAAA'),
  ]);
  const addresses = records.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : [],
  );
  if (addresses.length === 0)
    throw new ImportError(400, 'not-found', 'That website couldn’t be found.');
  if (addresses.some(isBlockedIp))
    throw new ImportError(
      400,
      'blocked-address',
      GUARD_MESSAGES['blocked-address'],
    );
}

async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ImportError(
        413,
        'too-large',
        'That page is too large to import.',
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return bytes;
}

function decode(bytes: Uint8Array, contentType: string | null): string {
  const charset = /charset=([\w-]+)/i.exec(contentType ?? '')?.[1];
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/**
 * Fetch a page, following redirects by hand so every hop is re-checked against the guards.
 * Note: a hostname can resolve differently between our DNS check and fetch's own lookup (DNS rebinding);
 * the runtime gives no way to pin the address, so this narrows the window rather than closing it.
 */
async function fetchPage(
  start: URL,
): Promise<{ html: string; finalUrl: string }> {
  const signal = AbortSignal.timeout(IMPORT_LIMITS.timeoutMs);
  let current = start;
  for (let hop = 0; hop <= IMPORT_LIMITS.maxRedirects; hop++) {
    await assertPublic(current);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'TimeoutError') {
        throw new ImportError(
          504,
          'timeout',
          'That website took too long to respond.',
        );
      }
      throw new ImportError(
        502,
        'fetch-failed',
        'That website couldn’t be reached.',
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location)
        throw new ImportError(
          502,
          'fetch-failed',
          'That website sent a broken redirect.',
        );
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ImportError(
        502,
        'fetch-failed',
        `That website answered with an error (${response.status}).`,
      );
    }
    const contentType = response.headers.get('content-type');
    if (!isHtml(contentType)) {
      await response.body?.cancel();
      throw new ImportError(415, 'not-html', 'That link isn’t a web page.');
    }
    const bytes = await readCapped(response, IMPORT_LIMITS.maxBytes);
    return { html: decode(bytes, contentType), finalUrl: current.href };
  }
  throw new ImportError(
    400,
    'too-many-redirects',
    'That link redirects too many times.',
  );
}

/** Counts the import against the caller's rate limit (PostgREST RPC, as the caller). */
async function registerImport(authorization: string): Promise<void> {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/register_url_import`,
    {
      method: 'POST',
      headers: {
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  if (response.status === 429)
    throw new ImportError(
      429,
      'rate-limited',
      'Too many imports. Try again in a few minutes.',
    );
  if (!response.ok)
    throw new ImportError(401, 'unauthorized', 'Please sign in again.');
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST')
    throw new ImportError(405, 'method-not-allowed', 'Use POST.');
  const authorization = request.headers.get('authorization');
  if (!authorization)
    throw new ImportError(401, 'unauthorized', 'Please sign in again.');

  const body = await request.text();
  if (body.length > 4096)
    throw new ImportError(400, 'invalid-request', 'Request too large.');
  let url: unknown;
  try {
    url = (JSON.parse(body) as { url?: unknown }).url;
  } catch {
    throw new ImportError(400, 'invalid-request', 'Send JSON: { "url": "…" }.');
  }
  const guard = checkUrl(typeof url === 'string' ? url : '');
  if (!guard.ok)
    throw new ImportError(400, guard.reason, GUARD_MESSAGES[guard.reason]);

  await registerImport(authorization);
  const { html, finalUrl } = await fetchPage(guard.url);

  const draft = await htmlParser.parse({ kind: 'html', html, url: finalUrl });
  if (!draft)
    throw new ImportError(
      422,
      'no-recipe',
      'No recipe was found on that page.',
    );
  const valid = RecipeDraftSchema.safeParse(draft);
  if (!valid.success)
    throw new ImportError(
      422,
      'no-recipe',
      'That page’s recipe couldn’t be read.',
    );
  return Response.json({ draft: valid.data });
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('origin'));
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });
  try {
    const response = await handle(request);
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  } catch (e) {
    const error =
      e instanceof ImportError
        ? e
        : new ImportError(
            500,
            'internal',
            'Something went wrong importing that page.',
          );
    if (!(e instanceof ImportError)) console.error(e);
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: cors },
    );
  }
});
