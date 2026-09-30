import {
  HttpError,
  guardedFetch,
  readCapped,
  type NetworkDeps,
} from './guarded-fetch.ts';

const PUBLIC_IP = '93.184.216.34';

/** Fake network: `pages` maps URL → response factory; every name resolves to `dns[host]` or a public IP. */
function network(
  pages: Record<string, () => Response>,
  dns: Record<string, string[]> = {},
): NetworkDeps & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    fetch: (async (input: URL | RequestInfo) => {
      const url = String(input);
      requested.push(url);
      const page = pages[url];
      if (!page) throw new TypeError('connection refused');
      return page();
    }) as typeof fetch,
    resolveDns: async (host, type) =>
      type === 'A' ? (dns[host] ?? [PUBLIC_IP]) : [],
  };
}

const redirect =
  (location: string, status = 302) =>
  () =>
    new Response(null, { status, headers: { location } });
const ok =
  (body = '<html></html>') =>
  () =>
    new Response(body, { headers: { 'content-type': 'text/html' } });

async function fetchFrom(url: string, net: NetworkDeps) {
  return guardedFetch(new URL(url), net, {
    accept: 'text/html',
    signal: AbortSignal.timeout(5000),
  });
}

async function failure(promise: Promise<unknown>): Promise<HttpError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpError);
  return error as HttpError;
}

describe('guardedFetch', () => {
  it('follows relative and absolute redirects to the final page', async () => {
    const net = network({
      'https://a.test/r': redirect('/moved', 301),
      'https://a.test/moved': redirect('https://b.test/final', 308),
      'https://b.test/final': ok(),
    });
    const { response, url } = await fetchFrom('https://a.test/r', net);
    expect(response.status).toBe(200);
    expect(url.href).toBe('https://b.test/final');
  });

  it('re-checks every hop: a redirect to a private address is refused', async () => {
    const net = network({
      'https://a.test/': redirect('http://169.254.169.254/latest'),
    });
    const error = await failure(fetchFrom('https://a.test/', net));
    expect(error).toMatchObject({ status: 400, code: 'blocked-address' });
    expect(net.requested).toEqual(['https://a.test/']);
  });

  it('refuses a redirect to another scheme', async () => {
    const net = network({ 'https://a.test/': redirect('file:///etc/passwd') });
    expect(await failure(fetchFrom('https://a.test/', net))).toMatchObject({
      code: 'unsupported-scheme',
    });
  });

  it('refuses names that resolve to private addresses', async () => {
    const net = network({}, { 'evil.test': ['8.8.8.8', '10.0.0.5'] });
    expect(await failure(fetchFrom('https://evil.test/', net))).toMatchObject({
      status: 400,
      code: 'blocked-address',
    });
    expect(net.requested).toEqual([]);
  });

  it('reports names that do not resolve', async () => {
    const net = network({}, { 'nowhere.test': [] });
    expect(
      await failure(fetchFrom('https://nowhere.test/', net)),
    ).toMatchObject({
      code: 'not-found',
    });
  });

  it('fails closed when one of the lookups errors', async () => {
    const net = network({ 'https://a.test/': ok() });
    net.resolveDns = async (_, type) => {
      if (type === 'A') throw new Error('SERVFAIL');
      return ['2606:4700:4700::1111'];
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await failure(fetchFrom('https://a.test/', net))).toMatchObject({
      status: 502,
      code: 'fetch-failed',
    });
    expect(net.requested).toEqual([]);
    warn.mockRestore();
  });

  it('stops after too many redirects', async () => {
    const net = network({ 'https://a.test/loop': redirect('/loop') });
    expect(await failure(fetchFrom('https://a.test/loop', net))).toMatchObject({
      code: 'too-many-redirects',
    });
    expect(net.requested).toHaveLength(6);
  });

  it.each([
    ['a missing Location', () => new Response(null, { status: 302 })],
    ['an unparseable Location', redirect('http://[bad')],
  ])('treats %s as a broken redirect', async (_, page) => {
    const net = network({ 'https://a.test/': page });
    expect(await failure(fetchFrom('https://a.test/', net))).toMatchObject({
      status: 502,
      code: 'fetch-failed',
    });
  });

  it('maps connection failures and timeouts', async () => {
    const refused = network({});
    expect(await failure(fetchFrom('https://a.test/', refused))).toMatchObject({
      status: 502,
      code: 'fetch-failed',
    });

    const slow = network({});
    slow.fetch = (async () => {
      throw new DOMException('timed out', 'TimeoutError');
    }) as typeof fetch;
    expect(await failure(fetchFrom('https://a.test/', slow))).toMatchObject({
      status: 504,
      code: 'timeout',
    });
  });
});

describe('readCapped', () => {
  const stream = (...chunks: Array<Uint8Array | Error>) =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          const next = chunks.shift();
          if (next instanceof Error) controller.error(next);
          else if (next) controller.enqueue(next);
          else controller.close();
        },
      }),
    );

  it('reads the whole body under the cap', async () => {
    const bytes = await readCapped(
      stream(new Uint8Array([1, 2]), new Uint8Array([3])),
      3,
    );
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it('refuses a body over the cap', async () => {
    const error = await failure(
      readCapped(stream(new Uint8Array(3), new Uint8Array(3)), 5),
    );
    expect(error).toMatchObject({ status: 413, code: 'too-large' });
  });

  it('maps a timeout while reading the body to 504', async () => {
    const error = await failure(
      readCapped(
        stream(
          new Uint8Array(1),
          new DOMException('timed out', 'TimeoutError'),
        ),
        10,
      ),
    );
    expect(error).toMatchObject({ status: 504, code: 'timeout' });
  });

  it('maps a dropped connection while reading to 502', async () => {
    const error = await failure(
      readCapped(stream(new Uint8Array(1), new TypeError('reset')), 10),
    );
    expect(error).toMatchObject({ status: 502, code: 'fetch-failed' });
  });
});
