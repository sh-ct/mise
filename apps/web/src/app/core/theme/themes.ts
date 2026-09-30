/**
 * Registered themes. Each id matches a stylesheet in `src/styles/themes/<id>.css` defining the token
 * contract for light and dark mode, and must also be listed in `public/theme-boot.js`.
 */
export const THEMES = [
  { id: 'market-stall', label: 'Market Stall' },
  { id: 'bento', label: 'Bento' },
  { id: 'night-kitchen', label: 'Night Kitchen' },
  { id: 'enamel', label: 'Enamel' },
  { id: 'order-ticket', label: 'Order Ticket' },
] as const;

export type Theme = (typeof THEMES)[number];
export type ThemeId = Theme['id'];

export const DEFAULT_THEME: ThemeId = 'market-stall';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}
