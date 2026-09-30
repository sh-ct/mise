// Applies the saved theme before first paint, so the page never flashes the wrong colours.
// Mirrors ThemeStore (src/app/core/theme): same storage key, same fallbacks. The themes and their light/dark
// canvas colours (for the browser's theme-color, before the stylesheets load) must match themes.ts and the
// theme files; themes.spec.ts checks both.
(function () {
  const CANVAS = {
    bento: ['#fbfbf8', '#16191b'],
    'market-stall': ['#f4f1e6', '#14231a'],
    'night-kitchen': ['#f2f6f5', '#0f1b1f'],
    enamel: ['#f6f8fb', '#0e1726'],
    'order-ticket': ['#f7faf6', '#151a18'],
  };
  const THEMES = Object.keys(CANVAS);
  const DEFAULT_THEME = 'bento';
  const APPEARANCES = ['light', 'dark', 'time', 'system'];
  const root = document.documentElement;
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem('theme-preferences') || '{}') || {};
  } catch {
    prefs = {};
  }
  const theme =
    THEMES.indexOf(prefs.themeId) >= 0 ? prefs.themeId : DEFAULT_THEME;
  const appearance =
    APPEARANCES.indexOf(prefs.appearance) >= 0 ? prefs.appearance : 'system';
  const hour = new Date().getHours();
  const dark =
    appearance === 'dark' ||
    (appearance === 'time' && (hour >= 19 || hour < 7)) ||
    (appearance === 'system' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-mode', dark ? 'dark' : 'light');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', CANVAS[theme][dark ? 1 : 0]);
})();
