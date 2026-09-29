/**
 * Parse an ISO 8601 duration as used by schema.org ("PT1H30M", "P0DT0H20M", "PT90M", "PT0.5H") into
 * whole minutes. Returns undefined for missing/invalid/zero values.
 */
export function isoDurationToMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const m =
    /^\s*P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?\s*$/i.exec(
      value,
    );
  if (!m) return undefined;
  const [, d, h, min, s] = m;
  const minutes =
    Number(d ?? 0) * 1440 +
    Number(h ?? 0) * 60 +
    Number(min ?? 0) +
    Number(s ?? 0) / 60;
  const rounded = Math.round(minutes);
  return rounded > 0 ? rounded : undefined;
}
