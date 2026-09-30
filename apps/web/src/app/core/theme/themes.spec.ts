import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_THEME, THEMES } from './themes';

// The Angular test runner starts in the workspace root.
const WEB = existsSync('apps/web') ? 'apps/web' : '.';
const read = (path: string) => readFileSync(join(WEB, path), 'utf8');

const COLOUR_TOKENS = [
  'canvas',
  'surface',
  'ink',
  'ink-muted',
  'line',
  'primary',
  'on-primary',
  'accent',
  'on-accent',
  'chip',
  'on-chip',
  'gloss',
  'progress',
  'tray-a',
  'tray-b',
  'on-tray-b',
  'danger',
  'focus',
];
const TYPE_TOKENS = [
  'font-display',
  'font-body',
  'font-num',
  'font-step',
  'display-weight',
  'step-size',
];

/** The declarations inside the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? undefined : css.slice(start, css.indexOf('}', start));
}

describe('theme registry and stylesheets', () => {
  it.each(THEMES.map((t) => t.id))(
    '%s defines the full token contract in light and dark',
    (id) => {
      const css = read(`src/styles/themes/${id}.css`);
      const light = block(css, `[data-theme='${id}']`);
      const dark = block(css, `[data-theme='${id}'][data-mode='dark']`);
      expect(light, 'light block').toBeDefined();
      expect(dark, 'dark block').toBeDefined();
      for (const token of COLOUR_TOKENS) {
        expect(light, `light --ds-${token}`).toContain(`--ds-${token}:`);
        expect(dark, `dark --ds-${token}`).toContain(`--ds-${token}:`);
      }
      for (const token of TYPE_TOKENS)
        expect(light, `--ds-${token}`).toContain(`--ds-${token}:`);
    },
  );

  it('imports every theme stylesheet', () => {
    const styles = read('src/styles.css');
    for (const { id } of THEMES)
      expect(styles).toContain(`./styles/themes/${id}.css`);
  });

  it('lists the same themes in the pre-boot script', () => {
    const boot = read('public/theme-boot.js');
    const list = /const THEMES = \[([^\]]*)\]/.exec(boot)?.[1] ?? '';
    expect(list.match(/'([^']+)'/g)?.map((s) => s.slice(1, -1))).toEqual(
      THEMES.map((t) => t.id),
    );
    expect(boot).toContain(`const DEFAULT_THEME = '${DEFAULT_THEME}';`);
  });
});
