// Deno entry point for import-url: wires the runtime's network and the rate-limit RPC into the handler,
// and adds CORS for the web app's origins.

import { handleImport, rateLimitVia } from './handler.ts';

const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:4200'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const deps = {
  fetch,
  resolveDns: async (
    host: string,
    type: 'A' | 'AAAA',
    options: { signal: AbortSignal },
  ) => {
    try {
      return await Deno.resolveDns(host, type, options);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return []; // no records of this type
      throw e;
    }
  },
  registerImport: rateLimitVia(
    fetch,
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  ),
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

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('origin'));
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });
  const response = await handleImport(request, deps);
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
});
