import { readWebFile, readWebText } from '../../../testing/workspace-file';
import { APP_NAME } from '../../app-name';
import { DEFAULT_THEME } from '../theme/themes';

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose: string;
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): string {
  const png = readWebFile(path);
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

/** The first `attr="…"` value in an HTML tag that contains `marker`, whatever the formatting. */
function attrOf(
  html: string,
  marker: string,
  attr: string,
): string | undefined {
  const tag = [...html.matchAll(/<(?:link|meta)\b[^>]*>/g)]
    .map((m) => m[0])
    .find((t) => t.includes(marker));
  return tag ? new RegExp(`${attr}="([^"]*)"`).exec(tag)?.[1] : undefined;
}

describe('web app manifest', () => {
  const manifest = JSON.parse(readWebText('public/manifest.webmanifest')) as {
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

  it('launches on the icon’s tile, with the default theme’s bar colour', () => {
    // The splash screen matches the icon for everyone, so dark-mode users don't get a white flash.
    const tile = /<rect [^>]*fill="(#[0-9a-f]+)"/i.exec(
      readWebText('icons/icon.svg'),
    )?.[1];
    expect(manifest.background_color).toBe(tile);
    const css = readWebText(`src/styles/themes/${DEFAULT_THEME}.css`);
    expect(manifest.theme_color).toBe(
      /--ds-canvas:\s*(#[0-9a-f]+)/i.exec(css)?.[1],
    );
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

  it('is linked from index.html with the home-screen icon and title', () => {
    const html = readWebText('src/index.html');
    expect(attrOf(html, 'rel="manifest"', 'href')).toBe('manifest.webmanifest');
    expect(attrOf(html, 'apple-mobile-web-app-title', 'content')).toBe(
      APP_NAME,
    );
    const touchIcon = attrOf(html, 'rel="apple-touch-icon"', 'href');
    expect(pngSize(`public/${touchIcon}`)).toBe('180x180');
  });
});
