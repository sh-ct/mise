import { expect, test } from '@playwright/test';

const isDesktop = (width: number) => width >= 1024;

test('opens on the recipe library', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Recipes' }),
  ).toBeVisible();
});

test('shows a sidebar on desktop and a tab bar on phones and tablets', async ({
  page,
}) => {
  await page.goto('/recipes');
  const desktop = isDesktop(page.viewportSize()?.width ?? 1280);
  const sidebar = page.locator('aside nav[aria-label="Main"]');
  const tabBar = page.locator('nav[aria-label="Main"]:not(aside nav)');
  await expect(desktop ? sidebar : tabBar).toBeVisible();
  await expect(desktop ? tabBar : sidebar).toBeHidden();

  await page
    .getByRole('link', { name: 'Settings' })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Settings' }).filter({ visible: true }),
  ).toHaveAttribute('aria-current', 'page');
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

test('switches style and shows a live sample of each', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('label [data-theme]')).toHaveCount(5);
  await page.getByRole('radio', { name: 'Order Ticket' }).check();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'order-ticket',
  );
  // Order Ticket headings are uppercase: a token, not a component style.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS(
    'text-transform',
    'uppercase',
  );
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

test.describe('before the app starts', () => {
  // Block the Angular bundle so only public/theme-boot.js has run.
  test.beforeEach(async ({ page }) => {
    await page.route(/\/(main|chunk)[^/]*\.js$/, (route) => route.abort());
  });

  const boot = async (
    page: import('@playwright/test').Page,
    prefs: unknown,
  ) => {
    await page.addInitScript(
      (value) =>
        localStorage.setItem('theme-preferences', JSON.stringify(value)),
      prefs,
    );
    await page.goto('/recipes');
    return page.locator('html');
  };

  test('applies a saved dark choice', async ({ page }) => {
    const root = await boot(page, { themeId: 'bento', appearance: 'dark' });
    await expect(root).toHaveAttribute('data-theme', 'bento');
    await expect(root).toHaveAttribute('data-mode', 'dark');
  });

  test('ignores unknown values, falling back like the app does', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const root = await boot(page, { themeId: 'sepia', appearance: 'auto' });
    await expect(root).toHaveAttribute('data-theme', 'market-stall');
    await expect(root).toHaveAttribute('data-mode', 'dark');
  });

  test('uses the clock for time-based appearance', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 30, 20, 0));
    const root = await boot(page, { appearance: 'time' });
    await expect(root).toHaveAttribute('data-mode', 'dark');
  });
});
