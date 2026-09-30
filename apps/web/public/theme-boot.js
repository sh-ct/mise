// Applies the saved theme before first paint, so the page never flashes the wrong colours.
// Mirrors ThemeStore (src/app/core/theme): same storage key, same fallbacks. The theme list must match
// THEMES in themes.ts; themes.spec.ts checks that.
(function () {
  const THEMES = [
    'bento',
    'market-stall',
    'night-kitchen',
    'enamel',
    'order-ticket',
  ];
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
})();
