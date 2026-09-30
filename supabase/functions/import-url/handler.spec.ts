import { HttpError } from '../_shared/guarded-fetch.ts';
import {
  decodeHtml,
  handleImport,
  isHtml,
  rateLimitVia,
  type ImportDeps,
} from './handler.ts';

const RECIPE_PAGE = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Toast',
    recipeIngredient: ['2 slices bread', '1 tbsp butter'],
    recipeInstructions: ['Toast the bread.', 'Spread with butter.'],
  },
)}</script></head><body></body></html>`;

function deps(
  page: () => Response,
  registerImport: ImportDeps['registerImport'] = async () => undefined,
): ImportDeps {
  return {
    fetch: (async () => page()) as typeof fetch,
    resolveDns: async (_, type) => (type === 'A' ? ['93.184.216.34'] : []),
    registerImport,
  };
}

const html =
  (body: string, contentType = 'text/html; charset=utf-8') =>
  () =>
    new Response(body, { headers: { 'content-type': contentType } });

const post = (
  body: unknown,
  headers: Record<string, string> = { authorization: 'Bearer t' },
) =>
  new Request('https://fn.test/import-url', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function errorOf(response: Response) {
  return {
    status: response.status,
    ...((await response.json()) as { error: object }).error,
  };
}

describe('handleImport', () => {
  it('returns a validated draft for a recipe page', async () => {
    const response = await handleImport(
      post({ url: 'https://recipes.test/toast' }),
      deps(html(RECIPE_PAGE)),
    );
    expect(response.status).toBe(200);
    const { draft } = (await response.json()) as {
      draft: Record<string, unknown>;
    };
    expect(draft).toMatchObject({
      title: 'Toast',
      sourceType: 'url',
      sourceUrl: 'https://recipes.test/toast',
    });
  });

  it.each([
    [
      'a GET',
      new Request('https://fn.test/', { method: 'GET' }),
      405,
      'method-not-allowed',
    ],
    [
      'no Authorization header',
      post({ url: 'https://a.test/' }, {}),
      401,
      'unauthorized',
    ],
    ['a body that is not JSON', post('url=x'), 400, 'invalid-request'],
    ['a missing url', post({}), 400, 'invalid-url'],
    ['a non-string url', post({ url: 42 }), 400, 'invalid-url'],
    ['JSON null', post('null'), 400, 'invalid-request'],
    [
      'a private address',
      post({ url: 'http://127.0.0.1/' }),
      400,
      'blocked-address',
    ],
    [
      'an oversized body',
      post({ url: `https://a.test/${'a'.repeat(5000)}` }),
      400,
      'invalid-request',
    ],
  ])('rejects %s', async (_, request, status, code) => {
    const registerImport = vi.fn(async () => undefined);
    const response = await handleImport(
      request,
      deps(html(RECIPE_PAGE), registerImport),
    );
    expect(await errorOf(response)).toMatchObject({ status, code });
    expect(registerImport).not.toHaveBeenCalled();
  });

  it('counts the import before fetching and stops when over the limit', async () => {
    const page = vi.fn(html(RECIPE_PAGE));
    const response = await handleImport(
      post({ url: 'https://a.test/' }),
      deps(page, async () => {
        throw new HttpError(429, 'rate-limited', 'Too many imports.');
      }),
    );
    expect(await errorOf(response)).toMatchObject({
      status: 429,
      code: 'rate-limited',
    });
    expect(page).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an error status',
      () => new Response('nope', { status: 404 }),
      502,
      'fetch-failed',
    ],
    ['a non-HTML page', html('{}', 'application/json'), 415, 'not-html'],
    [
      'a page without a recipe',
      html('<html><body><p>Hello.</p></body></html>'),
      422,
      'no-recipe',
    ],
  ])('reports %s', async (_, page, status, code) => {
    const response = await handleImport(
      post({ url: 'https://a.test/' }),
      deps(page),
    );
    expect(await errorOf(response)).toMatchObject({ status, code });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const response = await handleImport(
      post({ url: 'https://a.test/' }),
      deps(html(RECIPE_PAGE), async () => {
        throw new Error('database password is hunter2');
      }),
    );
    const body = await errorOf(response);
    expect(body).toMatchObject({ status: 500, code: 'internal' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    error.mockRestore();
  });
});

describe('rateLimitVia', () => {
  const limiter = (status: number) => {
    const fetchFn = vi.fn(async () => new Response(null, { status }));
    return {
      fetchFn,
      register: rateLimitVia(fetchFn as typeof fetch, 'https://db.test', 'key'),
    };
  };

  it('calls the RPC as the user', async () => {
    const { fetchFn, register } = limiter(204);
    await register('Bearer user-jwt');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://db.test/rest/v1/rpc/register_url_import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'key',
          Authorization: 'Bearer user-jwt',
        }),
      }),
    );
  });

  it.each([
    [429, 429, 'rate-limited'],
    [401, 401, 'unauthorized'],
    [403, 401, 'unauthorized'],
    [404, 503, 'unavailable'],
    [500, 503, 'unavailable'],
  ])('maps RPC status %i to %i %s', async (rpcStatus, status, code) => {
    const { register } = limiter(rpcStatus);
    await expect(register('Bearer t')).rejects.toMatchObject({ status, code });
  });
});

describe('isHtml', () => {
  it('accepts HTML content types only', () => {
    expect(isHtml('text/html; charset=utf-8')).toBe(true);
    expect(isHtml('application/xhtml+xml')).toBe(true);
    expect(isHtml('application/json')).toBe(false);
    expect(isHtml(null)).toBe(false);
  });
});

describe('decodeHtml', () => {
  const latin1 = (text: string) =>
    Uint8Array.from(text, (c) => c.charCodeAt(0));
  const HALF_CUP = 'Add ' + String.fromCharCode(0xbd) + ' cup milk';

  it('uses the Content-Type charset, quoted or not', () => {
    expect(decodeHtml(latin1(HALF_CUP), 'text/html; charset=ISO-8859-1')).toBe(
      'Add ½ cup milk',
    );
    expect(
      decodeHtml(latin1(HALF_CUP), 'text/html; charset="iso-8859-1"'),
    ).toBe('Add ½ cup milk');
  });

  it('falls back to <meta charset> and http-equiv in the page', () => {
    expect(
      decodeHtml(
        latin1(`<meta charset="iso-8859-1"><p>${HALF_CUP}`),
        'text/html',
      ),
    ).toContain('½ cup');
    expect(
      decodeHtml(
        latin1(
          `<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">${HALF_CUP}`,
        ),
        null,
      ),
    ).toContain('½ cup');
  });

  it('prefers a byte-order mark and strips it', () => {
    const bytes = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode('½ cup'),
    ]);
    expect(decodeHtml(bytes, 'text/html; charset=iso-8859-1')).toBe('½ cup');
  });

  it('uses UTF-8 by default and for unknown charsets', () => {
    const bytes = new TextEncoder().encode('½ cup');
    expect(decodeHtml(bytes, 'text/html')).toBe('½ cup');
    expect(decodeHtml(bytes, 'text/html; charset=klingon')).toBe('½ cup');
  });
});
