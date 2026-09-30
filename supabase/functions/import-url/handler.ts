// import-url: fetch a recipe page server-side and turn it into a RecipeDraft for the editor
// (docs/ARCHITECTURE.md#import-pipeline, #security). Deno wiring and CORS live in index.ts.
//
// POST { "url": "https://…" } with the user's JWT → 200 { "draft": RecipeDraft }
// Errors → { "error": { "code": string, "message": string } } with a matching HTTP status.

import { RecipeDraftSchema, htmlParser } from '@mise/core';
import {
  FETCH_LIMITS,
  HttpError,
  assertUrl,
  guardedFetch,
  readCapped,
  type NetworkDeps,
} from '../_shared/guarded-fetch.ts';

export interface ImportDeps extends NetworkDeps {
  /** Counts the import against the caller's rate limit; throws an HttpError when over it. */
  registerImport: (authorization: string) => Promise<void>;
}

export async function handleImport(
  request: Request,
  deps: ImportDeps,
): Promise<Response> {
  try {
    return Response.json({ draft: await importDraft(request, deps) });
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    const error =
      e instanceof HttpError
        ? e
        : new HttpError(
            500,
            'internal',
            'Something went wrong importing that page.',
          );
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
}

async function importDraft(request: Request, deps: ImportDeps) {
  if (request.method !== 'POST')
    throw new HttpError(405, 'method-not-allowed', 'Use POST.');
  const authorization = request.headers.get('authorization');
  if (!authorization)
    throw new HttpError(401, 'unauthorized', 'Please sign in again.');

  if (Number(request.headers.get('content-length') ?? 0) > 4096)
    throw new HttpError(400, 'invalid-request', 'Request too large.');
  const body = await request.text();
  if (body.length > 4096)
    throw new HttpError(400, 'invalid-request', 'Request too large.');
  let url: unknown;
  try {
    url = (JSON.parse(body) as { url?: unknown }).url;
  } catch {
    throw new HttpError(400, 'invalid-request', 'Send JSON: { "url": "…" }.');
  }
  const start = assertUrl(typeof url === 'string' ? url : '');

  // Counted before fetching, so failed fetches use up quota too: the limit is on outbound requests.
  await deps.registerImport(authorization);

  const signal = AbortSignal.timeout(FETCH_LIMITS.timeoutMs);
  const { response, url: finalUrl } = await guardedFetch(start, deps, {
    accept: 'text/html,application/xhtml+xml',
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(
      502,
      'fetch-failed',
      'That website answered with an error.',
    );
  }
  const contentType = response.headers.get('content-type');
  if (!isHtml(contentType)) {
    await response.body?.cancel();
    throw new HttpError(415, 'not-html', 'That link isn’t a web page.');
  }
  const html = decodeHtml(
    await readCapped(response, FETCH_LIMITS.maxBytes),
    contentType,
  );

  const draft = await htmlParser.parse({
    kind: 'html',
    html,
    url: finalUrl.href,
  });
  if (!draft)
    throw new HttpError(422, 'no-recipe', 'No recipe was found on that page.');
  const valid = RecipeDraftSchema.safeParse(draft);
  if (!valid.success)
    throw new HttpError(
      422,
      'no-recipe',
      'That page’s recipe couldn’t be read.',
    );
  return valid.data;
}

/** Whether a response's content type is a web page we can parse. */
export function isHtml(contentType: string | null): boolean {
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase();
  return type === 'text/html' || type === 'application/xhtml+xml';
}

const CHARSET = /charset\s*=\s*["']?([\w:.-]+)/i;

/**
 * Decode a page the way browsers pick its encoding: byte-order mark, then the Content-Type header, then a
 * <meta charset> or http-equiv in the first 1024 bytes, then UTF-8.
 */
export function decodeHtml(
  bytes: Uint8Array,
  contentType: string | null,
): string {
  const charset =
    bomCharset(bytes) ??
    CHARSET.exec(contentType ?? '')?.[1] ??
    metaCharset(bytes) ??
    'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function bomCharset(b: Uint8Array): string | undefined {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  return undefined;
}

function metaCharset(bytes: Uint8Array): string | undefined {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const meta = /<meta\b[^>]*charset[^>]*>/i.exec(head)?.[0];
  return meta ? CHARSET.exec(meta)?.[1] : undefined;
}

/** Rate limiting through the register_url_import RPC, called as the user (PostgREST maps PT429 to 429). */
export function rateLimitVia(
  fetchFn: typeof fetch,
  supabaseUrl: string,
  apiKey: string,
): ImportDeps['registerImport'] {
  return async (authorization) => {
    const response = await fetchFn(
      `${supabaseUrl}/rest/v1/rpc/register_url_import`,
      {
        method: 'POST',
        headers: {
          apikey: apiKey,
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
    await response.body?.cancel();
    if (response.ok) return;
    if (response.status === 429)
      throw new HttpError(
        429,
        'rate-limited',
        'Too many imports. Try again in a few minutes.',
      );
    if (response.status === 401 || response.status === 403)
      throw new HttpError(401, 'unauthorized', 'Please sign in again.');
    throw new HttpError(
      503,
      'unavailable',
      'Importing is unavailable right now. Try again soon.',
    );
  };
}
