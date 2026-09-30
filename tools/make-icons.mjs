// Renders apps/web/icons/icon.svg to the PNGs the web app manifest and iOS need. Run after changing the
// source icon: `node tools/make-icons.mjs` (uses Playwright's Chromium).
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..', 'apps', 'web');
const svg = readFileSync(join(root, 'icons', 'icon.svg'), 'utf8');
const out = join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });

// `rounded`: transparent corners for platforms that show the icon as-is; the others are full-bleed, because
// Android (maskable) and iOS crop icons to their own shape.
const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'maskable-512.png', size: 512, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
  { file: 'favicon-32.png', size: 32, rounded: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, rounded } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px;${
      rounded ? `clip-path:inset(0 round ${Math.round(size * 0.22)}px)` : ''
    }}</style>${svg}`,
  );
  await page.screenshot({ path: join(out, file), omitBackground: true });
}
await browser.close();
console.log(`Wrote ${ICONS.length} icons to ${out}`);
