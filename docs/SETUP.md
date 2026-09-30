# Hosted setup

One-time steps to take mise from the local stack to a deployed app: Supabase for data and auth, Cloudflare
Pages for the web app, and GitHub for CI and database deploys. Phase 0 is done when you can sign in on your
phone to the installed app, deployed from `main` ([PLAN](PLAN.md#phase-0--foundations)).

Values you'll collect along the way, and where they go:

| Value                    | From                                   | Goes to                                                        |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| Project ref              | Supabase → Project Settings → General  | GitHub repository variable `SUPABASE_PROJECT_ID`; the CSP      |
| Project URL              | Supabase → Project Settings → Data API | `apps/web/src/environments/environment.ts`                     |
| Publishable key (public) | Supabase → Project Settings → API Keys | `environment.ts` (safe to commit: RLS protects the data)       |
| Database password        | Chosen when creating the project       | GitHub `production` environment secret `SUPABASE_DB_PASSWORD`  |
| Personal access token    | Supabase → Account → Access Tokens     | GitHub `production` environment secret `SUPABASE_ACCESS_TOKEN` |
| Pages domain             | Cloudflare, after the first deploy     | Supabase Site URL; the import function's `ALLOWED_ORIGINS`     |

Never commit the database password, the access token or the secret (service-role) key. The access token can
reach every project on your Supabase account; if that matters, create the project under a separate account.

## 1. Supabase project

This is the checklist for the hosted auth settings; the reasons behind them are in
[ARCHITECTURE](ARCHITECTURE.md#auth).

1. Create a project on the free tier, in the region nearest you. Save the database password.
2. **Authentication → Sign In / Providers:**
   - **User Signups:** **Allow new users to sign up** off; **Confirm email** on.
   - **Email** provider: enabled; email OTP expiration 600 seconds, OTP length 6.
3. **Authentication → Rate Limits:** keep the defaults (a new code at most every 60 seconds per address; the
   sign-in page's resend countdown matches it).
4. **Authentication → Emails → Templates:** for both **Magic link** and **Confirm signup**, set the subject to
   "Your sign-in code" and the body to `supabase/templates/magic-link.html`. Its link goes to
   `{{ .SiteURL }}/auth/confirm`; the Site URL is set in step 4.3, and until then links point at Supabase's
   default.
5. **Authentication → Users → Add user → Create new user** for yourself, with **Auto Confirm User** ticked.
   Sign-up is off, so this is the only way in.
6. Before anyone else uses it: **Authentication → Emails → SMTP Settings** with a custom provider (e.g.
   Resend's free tier). Supabase's built-in email sends only a few messages an hour.

Don't run `supabase config push`: `supabase/config.toml` holds local values.

## 2. App configuration (a PR, merged before the first Pages deploy)

1. `apps/web/src/environments/environment.ts`: set `supabaseUrl` and `supabaseKey` (the publishable key).
   Until then a production build won't start.
2. `apps/web/public/_headers`: in the CSP, replace `https://*.supabase.co` and `wss://*.supabase.co` with your
   project's host, `https://<ref>.supabase.co` and `wss://<ref>.supabase.co`.

## 3. GitHub

1. **Settings → Environments → New environment `production`:**
   - **Deployment branches:** selected branches, `main` only (so no other branch can use its secrets).
   - **Secrets:** `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.
2. **Settings → Secrets and variables → Actions → Variables:** repository variable `SUPABASE_PROJECT_ID` = the
   project ref. This switches on the `Deploy database` workflow (`.github/workflows/deploy-db.yml`), which
   applies new migrations after each merge to `main`. Before it's set the workflow is skipped; after, a missing
   secret fails the run.
3. Apply the existing migrations once: **Actions → Deploy database → Run workflow** (on `main`).
4. **Settings → Rules → Rulesets** (or **Branches**) for `main`:
   - require a pull request, with branches up to date before merging (so migrations from two PRs can't
     interleave);
   - required checks `main` and `database`, plus `functions` once the URL import PR is merged;
   - block force pushes and deletions, with no bypass for admins.

## 4. Cloudflare Pages

1. **Workers & Pages → Create application → Pages → Import an existing Git repository**, and choose this
   repository.
2. Build settings:
   - Production branch: `main`
   - Build command: `npx --yes pnpm@12.8.1 install --frozen-lockfile && npx --yes pnpm@12.8.1 nx build web`
     (keep the version in step with `packageManager` in `package.json`)
   - Build output directory: `dist/apps/web/browser`
   - Environment variables: `NODE_VERSION` = `24`, `NX_NO_CLOUD` = `true`, `SKIP_DEPENDENCY_INSTALL` = `true`
     (the build command installs with the repo's pnpm version instead).
3. After the first deploy, in Supabase **Authentication → URL Configuration**: Site URL = the production domain
   (`https://….pages.dev` or a custom domain), and the same exact URL under redirect URLs. Never add wildcard
   or preview URLs there.
4. Leave Cloudflare's HTML rewriting off for this site (Web Analytics auto-injection, email obfuscation, Rocket
   Loader). The CSP would block it, and it breaks the service worker's update check
   ([ARCHITECTURE](ARCHITECTURE.md#security)).

Every PR from this repository also gets a preview deployment (fork PRs don't build). Previews use the
production Supabase project, so signing in on a preview gives that unreviewed build your real session. That's
fine while you're the only contributor; before adding collaborators, put previews behind Cloudflare Access or
point them at a separate project.

## 5. URL import function (once its PR is merged)

`--use-api` bundles on Supabase's side, which picks up `packages/core` from outside `supabase/` through the
function's `deno.json` import map ([ADR 0008](adr/0008-core-in-deno.md)) and needs no Docker.

```bash
pnpm exec supabase functions deploy import-url --use-api --project-ref <ref>
```

```bash
pnpm exec supabase secrets set ALLOWED_ORIGINS=https://<your-domain> --project-ref <ref>
```

URL import then works from the production domain only, not from previews. On the first deploy, import one
recipe to check the function starts and can call the rate-limit RPC (it reads the `SUPABASE_URL` and
`SUPABASE_ANON_KEY` the platform injects).

## 6. Check it works

1. Open the production URL on your phone and sign in with the emailed code.
2. Add it to the home screen, open it from there, and sign in again with a code (the installed app has its own
   storage).
3. Turn on airplane mode and reopen it: the app still starts.
