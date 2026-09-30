/**
 * Registered themes. Each id matches a stylesheet in `src/styles/themes/<id>.css` that defines the full
 * token contract for light and dark mode.
 */
export const THEMES = [
  {
    id: 'market-stall',
    label: 'Market Stall',
    fonts:
      'https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&family=Rubik:wght@500;700;800&display=swap',
  },
  {
    id: 'bento',
    label: 'Bento',
    fonts:
      'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap',
  },
  {
    id: 'night-kitchen',
    label: 'Night Kitchen',
    fonts:
      'https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Recursive:slnt,wght,CASL,MONO@-15..0,400..900,0..1,0..1&display=swap',
  },
  {
    id: 'enamel',
    label: 'Enamel',
    fonts:
      'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&display=swap',
  },
  {
    id: 'order-ticket',
    label: 'Order Ticket',
    fonts:
      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap',
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'market-stall';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function themeById(id: ThemeId) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
