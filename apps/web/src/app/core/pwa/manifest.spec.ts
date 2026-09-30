import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME } from '../../app-name';
import { DEFAULT_THEME } from '../theme/themes';

// The Angular test runner starts in the workspace root.
const WEB = existsSync('apps/web') ? 'apps/web' : '.';
const read = (path: string) => readFileSync(join(WEB, path));

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose: string;
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): string {
  const png = read(path);
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe('web app manifest', () => {
  const manifest = JSON.parse(
    read('public/manifest.webmanifest').toString(),
  ) as {
    name: string;
    short_name: string;
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
  };

  it('uses the display name', () => {
    expect(manifest.name).toBe(APP_NAME);
    expect(manifest.short_name).toBe(APP_NAME);
  });

  it('launches on the default theme’s canvas colour', () => {
    const css = read(`src/styles/themes/${DEFAULT_THEME}.css`).toString();
    const canvas = /--ds-canvas:\s*(#[0-9a-f]+)/i.exec(css)?.[1];
    expect(manifest.background_color).toBe(canvas);
    expect(manifest.theme_color).toBe(canvas);
  });

  it('has 192 and 512 icons plus a maskable one, each the size it claims', () => {
    for (const icon of manifest.icons)
      expect(pngSize(`public/${icon.src}`), icon.src).toBe(icon.sizes);
    const any = manifest.icons
      .filter((i) => i.purpose === 'any')
      .map((i) => i.sizes);
    expect(any).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('is linked from index.html with iOS home-screen icon and title', () => {
    const html = read('src/index.html').toString();
    expect(html).toContain(
      '<link rel="manifest" href="manifest.webmanifest" />',
    );
    expect(html).toContain(
      `<meta name="apple-mobile-web-app-title" content="${APP_NAME}" />`,
    );
    const touchIcon = /rel="apple-touch-icon" href="([^"]+)"/.exec(html)?.[1];
    expect(pngSize(`public/${touchIcon}`)).toBe('180x180');
  });
});
