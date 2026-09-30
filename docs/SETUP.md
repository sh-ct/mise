# Hosted setup

One-time steps to take mise from the local stack to a deployed app: Supabase for data and auth, Cloudflare
Pages for the web app, and GitHub for CI and database deploys. Phase 0 is done when you can sign in on your
phone to the installed app, deployed from `main` ([PLAN](PLAN.md#phase-0--foundations)).

Values you'll collect along the way, and where they go:

| Value                    | From                                   | Goes to                                                      |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------ |
| Project ref              | Supabase → Project Settings → General  | GitHub variable `SUPABASE_PROJECT_ID`; the CSP in `_headers` |
| Project URL              | Supabase → Project Settings → Data API | `apps/web/src/environments/environment.ts`                   |
| Publishable key (public) | Supabase → Project Settings → API Keys | `environment.ts` (safe to commit: RLS protects the data)     |
| Database password        | Chosen when creating the project       | GitHub secret `SUPABASE_DB_PASSWORD`                         |
| Personal access token    | Supabase → Account → Access Tokens     | GitHub secret `SUPABASE_ACCESS_TOKEN`                        |
| Pages domain             | Cloudflare, after the first deploy     | Supabase Site URL; the import function's `ALLOWED_ORIGINS`   |

Never commit the database password, the access token or the secret (service-role) key.

## 1. Supabase project

1. Create a project on the free tier, in the region nearest you. Save the database password.
2. **Authentication → Sign In / Providers → Email:** enabled; **Allow new users to sign up** off; **Confirm
   email** on; email OTP expiry 600 seconds, length 6.
3. **Authentication → Emails → Templates:** for both **Magic link** and **Confirm signup**, set the subject to
   "Your sign-in code" and the body to `supabase/templates/magic-link.html`. The link in it goes to
   `{{ .SiteURL }}/auth/confirm`.
4. **Authentication → URL Configuration:** Site URL = your Pages domain (step 4; `https://…pages.dev` or a
   custom domain). Add it to the redirect URLs too.
5. **Authentication → Users → Add user → Create new user** for yourself, with auto-confirm. Sign-up is off, so
   this is the only way in.
6. Before anyone else uses it: **Authentication → Emails → SMTP** with a custom provider (e.g. Resend's free
   tier). Supabase's built-in email is limited to a few messages an hour.

Keep the other auth settings at their defaults. Don't run `supabase config push`: `supabase/config.toml` holds
local values ([ARCHITECTURE](ARCHITECTURE.md#auth)).

## 2. App configuration (a PR)

1. `apps/web/src/environments/environment.ts`: set `supabaseUrl` and `supabaseKey` (the publishable key).
2. `apps/web/public/_headers`: in the CSP, replace `https://*.supabase.co` and `wss://*.supabase.co` with your
   project's host, `https://<ref>.supabase.co` and `wss://<ref>.supabase.co`.

## 3. GitHub

1. **Settings → Environments → New environment `production`.** Add:
   - variable `SUPABASE_PROJECT_ID` = the project ref;
   - secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.

   The `Deploy database` workflow (`.github/workflows/deploy-db.yml`) then applies new migrations after each
   merge to `main`. Until these exist it skips itself.

2. Apply the existing migrations once: **Actions → Deploy database → Run workflow**.
3. **Settings → Branches → Add rule for `main`:** require a pull request; require the `main`, `database` and
   `functions` checks to pass; block force pushes.

## 4. Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git**, and choose this repository.
2. Build settings:
   - Production branch: `main`
   - Build command: `npx --yes pnpm@12.8.1 install --frozen-lockfile && npx --yes pnpm@12.8.1 nx build web`
   - Build output directory: `dist/apps/web/browser`
   - Environment variables: `NODE_VERSION` = `24`, `NX_NO_CLOUD` = `true`, `SKIP_DEPENDENCY_INSTALL` = `true`
     (the build command installs with the repo's pnpm version).
3. After the first deploy, put the domain into Supabase's Site URL (step 1.4).
4. Leave Cloudflare's HTML rewriting off for this site (Web Analytics auto-injection, email obfuscation, Rocket
   Loader). The CSP would block it, and it breaks the service worker's update check
   ([ARCHITECTURE](ARCHITECTURE.md#security)).

Every PR also gets a preview deployment. Previews use the same Supabase project, and sign-in email links always
go to the Site URL.

## 5. URL import function (once its PR is merged)

```bash
pnpm exec supabase functions deploy import-url --project-ref <ref>
```

```bash
pnpm exec supabase secrets set ALLOWED_ORIGINS=https://<your-domain> --project-ref <ref>
```

The function imports `packages/core` through its `deno.json` import map ([ADR 0008](adr/0008-core-in-deno.md)).
On the first deploy, check the function responds, since that import path has only run locally so far.

## 6. Check it works

1. Open the Pages URL on your phone and sign in with the emailed code.
2. Add it to the home screen, open it from there, and sign in again with a code (the installed app has its own
   storage).
3. Turn on airplane mode and reopen it: the app still starts.
