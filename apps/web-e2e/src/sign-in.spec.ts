import { expect, test } from '@playwright/test';
import { createUser, deleteUser, latestCode } from './support/supabase';

// These start signed out, each with its own user, so runs and devices never share a mailbox or a session.
test.use({ storageState: { cookies: [], origins: [] } });

let user: { id: string; email: string };

test.beforeEach(async () => {
  user = await createUser(test.info().project.name);
});

test.afterEach(async () => {
  await deleteUser(user.id);
});

test('signs in with the emailed code and returns to the page asked for', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);

  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText(`If ${user.email} has an account`)).toBeVisible();
  await expect(page.getByLabel('Code')).toBeFocused();

  // The sixth digit submits.
  await page.getByLabel('Code').fill(await latestCode(user.email));
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible();
});

test('explains a wrong code and a missing email', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText('Enter your email address.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send code' }).click();
  const code = Number(await latestCode(user.email));
  const wrong = String((code + 1) % 1_000_000).padStart(6, '0');
  await page.getByLabel('Code').fill(wrong);
  await expect(
    page.getByText('That code is wrong or has expired.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('signs out and guards signed-in pages', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Code').fill(await latestCode(user.email));
  await expect(page).toHaveURL(/\/recipes$/);

  await page
    .getByRole('link', { name: 'Settings' })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goto('/recipes');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Frecipes$/);
});

test('refuses a used or broken sign-in link', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=not-a-real-token&type=email');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'This link has expired' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Get a new code' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
