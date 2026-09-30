import { execSync } from 'node:child_process';
import { workspaceRoot } from '@nx/devkit';

// E2E talks to the local Supabase stack (`pnpm db:start`) only: its admin API to create users and mint
// sign-in links, and Mailpit to read the emails the app sends.

interface LocalStack {
  API_URL: string;
  SERVICE_ROLE_KEY: string;
  MAILPIT_URL: string;
}

let stack: LocalStack | undefined;

function local(): LocalStack {
  stack ??= JSON.parse(
    execSync('pnpm exec supabase status -o json', {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString(),
  ) as LocalStack;
  return stack;
}

async function admin(
  path: string,
  init: RequestInit = {},
  allowStatus?: number,
): Promise<Response> {
  const { API_URL, SERVICE_ROLE_KEY } = local();
  const response = await fetch(`${API_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok && response.status !== allowStatus)
    throw new Error(
      `admin ${path}: ${response.status} ${await response.text()}`,
    );
  return response;
}

/** Creates a confirmed user (sign-up is off, so tests create users through the admin API). */
async function postUser(email: string, allowExisting = false): Promise<string> {
  const response = await admin(
    'users',
    { method: 'POST', body: JSON.stringify({ email, email_confirm: true }) },
    allowExisting ? 422 : undefined,
  );
  return ((await response.json()) as { id?: string }).id ?? '';
}

/** A user with an address unique to this test run. */
export async function createUser(
  label: string,
): Promise<{ id: string; email: string }> {
  const email =
    `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mise.test`
      .toLowerCase()
      .replace(/[^a-z0-9@.-]/g, '-');
  return { id: await postUser(email), email };
}

/** A user with a fixed address, created on first use (422: already exists). */
export async function ensureUser(email: string): Promise<void> {
  await postUser(email, true);
}

export async function deleteUser(id: string): Promise<void> {
  await admin(`users/${id}`, { method: 'DELETE' });
}

/** The token hash from a sign-in link, as the email template puts it in /auth/confirm?token_hash=…. */
export async function signInTokenHash(email: string): Promise<string> {
  const link = (await (
    await admin('generate_link', {
      method: 'POST',
      body: JSON.stringify({ type: 'magiclink', email }),
    })
  ).json()) as { hashed_token?: string; properties?: { hashed_token: string } };
  const hash = link.hashed_token ?? link.properties?.hashed_token;
  if (!hash) throw new Error('generate_link returned no token hash');
  return hash;
}

/** The 6-digit code from the newest email to `email`, waiting briefly for it to arrive. */
export async function latestCode(email: string): Promise<string> {
  const { MAILPIT_URL } = local();
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await (
      await fetch(
        `${MAILPIT_URL}/api/v1/search?limit=1&query=${encodeURIComponent(`to:"${email}"`)}`,
      )
    ).json()) as { messages: Array<{ ID: string }> };
    const id = search.messages[0]?.ID;
    if (id) {
      const message = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)
      ).json()) as { Text: string };
      const code = /\b(\d{6})\b/.exec(message.Text)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no sign-in email for ${email}`);
}
