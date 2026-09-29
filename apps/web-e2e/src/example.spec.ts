import { test, expect } from '@playwright/test';

test('shows the app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Mise');
});
