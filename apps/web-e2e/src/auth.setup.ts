import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './support/auth-state';
import { ensureUser, signInTokenHash } from './support/supabase';

const SHARED_USER = 'e2e-shared@mise.test';

// Signs one user in through the email-link page and saves the session for the other specs. The code path
// is covered in sign-in.spec.ts.
test('sign in with an email link', async ({ page }) => {
  await ensureUser(SHARED_USER);
  await page.goto(
    `/auth/confirm?token_hash=${await signInTokenHash(SHARED_USER)}&type=email`,
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await page.context().storageState({ path: AUTH_STATE });
});
