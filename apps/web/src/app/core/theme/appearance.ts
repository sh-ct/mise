/** How the app chooses between light and dark. */
export type Appearance = 'light' | 'dark' | 'time' | 'system';
export type Mode = 'light' | 'dark';

export const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Always light' },
  { value: 'dark', label: 'Always dark' },
  { value: 'time', label: 'Auto by time of day' },
  { value: 'system', label: 'Auto by device theme' },
];

export const DEFAULT_APPEARANCE: Appearance = 'system';

export function isAppearance(value: unknown): value is Appearance {
  return APPEARANCES.some((a) => a.value === value);
}

/** Dark from 19:00 until 07:00 local time. */
export function isNightTime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 19 || hour < 7;
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
