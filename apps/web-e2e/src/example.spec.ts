import { expect, test } from '@playwright/test';

test('opens on the recipe library', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Recipes' }),
  ).toBeVisible();
});

test('shows a tab bar on phones and a sidebar on larger screens', async ({
  page,
}) => {
  await page.goto('/recipes');
  const isPhone = (page.viewportSize()?.width ?? 1024) < 768;
  const tabBar = page
    .locator('nav[aria-label="Main"]')
    .filter({ has: page.getByText('Settings') })
    .last();
  const sidebar = page.locator('aside nav[aria-label="Main"]');
  if (isPhone) {
    await expect(tabBar).toBeVisible();
    await expect(sidebar).toBeHidden();
  } else {
    await expect(sidebar).toBeVisible();
  }
  await page
    .getByRole('link', { name: 'Settings' })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible();
});

test('applies and remembers the appearance choice', async ({ page }) => {
  await page.goto('/settings');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'market-stall');

  await page.getByRole('radio', { name: /Always dark/ }).check();
  await expect(root).toHaveAttribute('data-mode', 'dark');

  await page.reload();
  await expect(root).toHaveAttribute('data-mode', 'dark');
  await expect(page.getByRole('radio', { name: /Always dark/ })).toBeChecked();

  await page.getByRole('radio', { name: /Always light/ }).check();
  await expect(root).toHaveAttribute('data-mode', 'light');
});

test('follows the device theme by default', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/recipes');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
});

test('never scrolls sideways', async ({ page }) => {
  for (const path of ['/recipes', '/settings']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
