/** How the app chooses between light and dark. */
export type Appearance = 'light' | 'dark' | 'time' | 'system';
export type Mode = 'light' | 'dark';

/** Evening hours for time-based appearance: dark from NIGHT_STARTS until DAY_STARTS (local time). */
export const NIGHT_STARTS = 19;
export const DAY_STARTS = 7;

export const APPEARANCES: readonly {
  value: Appearance;
  label: string;
  hint: string;
}[] = [
  { value: 'light', label: 'Always light', hint: 'Light all the time.' },
  { value: 'dark', label: 'Always dark', hint: 'Dark all the time.' },
  {
    value: 'time',
    label: 'Auto by time of day',
    hint: `Dark from ${NIGHT_STARTS - 12}pm to ${DAY_STARTS}am.`,
  },
  {
    value: 'system',
    label: 'Auto by device theme',
    hint: 'Follows your device’s light or dark setting.',
  },
];

export const DEFAULT_APPEARANCE: Appearance = 'system';

export function isAppearance(value: unknown): value is Appearance {
  return APPEARANCES.some((a) => a.value === value);
}

export function isNightTime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= NIGHT_STARTS || hour < DAY_STARTS;
}

export function resolveMode(
  appearance: Appearance,
  now: Date,
  systemPrefersDark: boolean,
): Mode {
  switch (appearance) {
    case 'light':
    case 'dark':
      return appearance;
    case 'time':
      return isNightTime(now) ? 'dark' : 'light';
    case 'system':
      return systemPrefersDark ? 'dark' : 'light';
  }
}
