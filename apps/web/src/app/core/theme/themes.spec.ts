import { readWebText as read } from '../../../testing/workspace-file';
import { DEFAULT_THEME, THEMES } from './themes';

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

  it('lists the same themes and canvas colours in the pre-boot script', () => {
    const boot = read('public/theme-boot.js');
    const entries = [
      ...boot.matchAll(/'?([\w-]+)'?: \['(#[0-9a-f]+)', '(#[0-9a-f]+)'\]/gi),
    ];
    expect(entries.map((m) => m[1])).toEqual(THEMES.map((t) => t.id));
    for (const [, id, light, dark] of entries) {
      const css = read(`src/styles/themes/${id}.css`);
      const canvas = (selector: string) =>
        /--ds-canvas:\s*(#[0-9a-f]+)/i.exec(block(css, selector) ?? '')?.[1];
      expect(light, `${id} light`).toBe(canvas(`[data-theme='${id}']`));
      expect(dark, `${id} dark`).toBe(
        canvas(`[data-theme='${id}'][data-mode='dark']`),
      );
    }
    expect(boot).toContain(`const DEFAULT_THEME = '${DEFAULT_THEME}';`);
  });
});
