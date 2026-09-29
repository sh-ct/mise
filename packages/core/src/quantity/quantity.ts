const VULGAR: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const VULGAR_CLASS = Object.keys(VULGAR).join('');

const WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  'a half': 0.5,
  dozen: 12,
  'a dozen': 12,
};

// A single number: mixed "1 1/2", "1½", "1 ½", fraction "1/2", decimal "1.5" / "1,5", integer, vulgar "½".
const NUMBER = `(?:\\d+\\s*[${VULGAR_CLASS}]|\\d+\\s+\\d+\\s*[/⁄]\\s*\\d+|\\d+\\s*[/⁄]\\s*\\d+|\\d+(?:[.,]\\d+)?|[${VULGAR_CLASS}])`;
const WORD = `(?:${Object.keys(WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|')})`;
const RANGE_SEP = `\\s*(?:-|–|—|to|or)\\s*`;

/** Regex source matching a number, e.g. for use in other parsers. */
export const NUMBER_PATTERN = NUMBER;

const LEADING_QTY = new RegExp(
  `^(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?(?![\\p{N}/])`,
  'u',
);
const LEADING_WORD_QTY = new RegExp(`^(${WORD})(?![\\p{L}\\p{N}])`, 'iu');

/** Parse one number token ("1 1/2", "½", "2,5"). Returns undefined if it isn't one. */
export function parseNumber(text: string): number | undefined {
  const s = text.trim().replace(/⁄/g, '/');
  if (!new RegExp(`^${NUMBER}$`, 'u').test(s)) return undefined;
  const vulgarMixed = new RegExp(`^(\\d+)\\s*([${VULGAR_CLASS}])$`, 'u').exec(
    s,
  );
  if (vulgarMixed)
    return Number(vulgarMixed[1]) + (VULGAR[vulgarMixed[2] ?? ''] ?? 0);
  if (VULGAR[s] !== undefined) return VULGAR[s];
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (frac)
    return Number(frac[2]) === 0
      ? undefined
      : Number(frac[1]) / Number(frac[2]);
  return Number(s.replace(',', '.'));
}

export interface LeadingQuantity {
  min: number;
  max?: number;
  /** Characters consumed from the input, including trailing whitespace. */
  length: number;
}

/**
 * Parse a quantity at the start of `text`: numbers, ranges ("2-3", "2 to 3"), and words ("a", "two",
 * "half"). Word quantities are only accepted when `allowWords` is set, because "a" is ambiguous.
 */
export function parseLeadingQuantity(
  text: string,
  options: { allowWords?: boolean } = {},
): LeadingQuantity | undefined {
  const m = LEADING_QTY.exec(text);
  if (m) {
    const min = parseNumber(m[1] ?? '');
    const max = m[2] !== undefined ? parseNumber(m[2]) : undefined;
    if (min === undefined || min <= 0) return undefined;
    const length =
      m[0].length + (/^\s*/.exec(text.slice(m[0].length))?.[0].length ?? 0);
    return max !== undefined && max > min
      ? { min, max, length }
      : { min, length };
  }
  if (options.allowWords) {
    const w = LEADING_WORD_QTY.exec(text);
    if (w) {
      const min = WORDS[(w[1] ?? '').toLowerCase()];
      if (min === undefined) return undefined;
      const length =
        w[0].length + (/^\s*/.exec(text.slice(w[0].length))?.[0].length ?? 0);
      return { min, length };
    }
  }
  return undefined;
}

const FRACTIONS: Array<[number, string]> = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

/**
 * Format a quantity for display.
 * - `fraction`: nearest kitchen fraction (⅛ steps plus thirds) — for cups/spoons/counts.
 * - `decimal`: sensible rounding — for metric weights and volumes.
 */
export function formatQuantity(
  value: number,
  style: 'fraction' | 'decimal' = 'fraction',
): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (style === 'decimal') return formatDecimal(value);

  let whole = Math.floor(value);
  const rest = value - whole;
  let best: [number, string] = [0, ''];
  let bestErr = rest;
  for (const f of FRACTIONS) {
    const err = Math.abs(rest - f[0]);
    if (err < bestErr) [best, bestErr] = [f, err];
  }
  if (1 - rest < bestErr) {
    whole += 1;
    best = [0, ''];
  }
  if (whole === 0 && best[1] === '') return formatDecimal(value); // tiny amounts: show "0.05" not ""
  return `${whole > 0 ? whole : ''}${best[1]}`;
}

function formatDecimal(value: number): string {
  let rounded: number;
  if (value >= 100) rounded = Math.round(value / 5) * 5;
  else if (value >= 10) rounded = Math.round(value);
  else if (value >= 1) rounded = Math.round(value * 10) / 10;
  else rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function formatRange(
  min: number,
  max: number | undefined,
  style: 'fraction' | 'decimal' = 'fraction',
): string {
  const a = formatQuantity(min, style);
  if (max === undefined) return a;
  const b = formatQuantity(max, style);
  return a === b ? a : `${a}–${b}`;
}
