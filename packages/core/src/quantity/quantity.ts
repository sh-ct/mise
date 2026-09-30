const VULGAR = new Map<string, number>([
  ['½', 1 / 2],
  ['⅓', 1 / 3],
  ['⅔', 2 / 3],
  ['¼', 1 / 4],
  ['¾', 3 / 4],
  ['⅕', 1 / 5],
  ['⅖', 2 / 5],
  ['⅗', 3 / 5],
  ['⅘', 4 / 5],
  ['⅙', 1 / 6],
  ['⅚', 5 / 6],
  ['⅛', 1 / 8],
  ['⅜', 3 / 8],
  ['⅝', 5 / 8],
  ['⅞', 7 / 8],
]);
const VULGAR_CLASS = [...VULGAR.keys()].join('');

/** Number words accepted as quantities ("a pinch", "two eggs"). */
export const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  ['a', 1],
  ['an', 1],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['half', 0.5],
  ['a half', 0.5],
  ['dozen', 12],
  ['a dozen', 12],
]);

/**
 * Regex source for one number: US mixed "1-1/2", mixed "1 1/2" / "1½", fraction "1/2", decimal "1.5" /
 * "1,5", integer, or a vulgar fraction "½".
 */
export const NUMBER_PATTERN = `(?:\\d+-\\d+\\s*[/⁄]\\s*\\d+|\\d+\\s*[${VULGAR_CLASS}]|\\d+\\s+\\d+\\s*[/⁄]\\s*\\d+|\\d+\\s*[/⁄]\\s*\\d+|\\d+(?:[.,]\\d+)?|[${VULGAR_CLASS}])`;

/** Regex source for a range separator: "2-3", "2 – 3", "2 to 3", "1 or 2". */
export const RANGE_SEPARATOR_PATTERN = `\\s*(?:-|–|—|to|or)\\s*`;

const WORD_PATTERN = `(?:${[...NUMBER_WORDS.keys()].sort((a, b) => b.length - a.length).join('|')})`;
const LEADING_QTY = new RegExp(
  `^(${NUMBER_PATTERN})(?:${RANGE_SEPARATOR_PATTERN}(${NUMBER_PATTERN}))?(?![\\p{N}/])`,
  'u',
);
const LEADING_WORD_QTY = new RegExp(
  `^(${WORD_PATTERN})(?![\\p{L}\\p{N}])`,
  'iu',
);
const WHOLE_NUMBER = new RegExp(`^${NUMBER_PATTERN}$`, 'u');

/** Parse one number token ("1 1/2", "1-1/2", "½", "2,5"). Returns undefined if it isn't one. */
export function parseNumber(text: string): number | undefined {
  const s = text.trim().replace(/⁄/g, '/');
  if (!WHOLE_NUMBER.test(s)) return undefined;
  const vulgar = VULGAR.get(s.slice(-1));
  if (vulgar !== undefined) return Number(s.slice(0, -1).trim() || 0) + vulgar;
  const mixed = /^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed)
    return Number(mixed[3]) === 0
      ? undefined
      : Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
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
  const trailingSpace = (from: number) =>
    /^\s*/.exec(text.slice(from))?.[0].length ?? 0;
  const m = LEADING_QTY.exec(text);
  if (m) {
    const min = parseNumber(m[1] ?? '');
    const max = m[2] !== undefined ? parseNumber(m[2]) : undefined;
    if (min === undefined || min <= 0) return undefined;
    const length = m[0].length + trailingSpace(m[0].length);
    return max !== undefined && max > min
      ? { min, max, length }
      : { min, length };
  }
  if (options.allowWords) {
    const w = LEADING_WORD_QTY.exec(text);
    const min = w ? NUMBER_WORDS.get((w[1] ?? '').toLowerCase()) : undefined;
    if (w && min !== undefined)
      return { min, length: w[0].length + trailingSpace(w[0].length) };
  }
  return undefined;
}

export type QuantityStyle = 'fraction' | 'decimal';

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

interface Rounded {
  value: number;
  text: string;
}

function roundFraction(value: number): Rounded {
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
  // Too small for any kitchen fraction: fall back to decimals rather than show nothing.
  if (whole === 0 && best[1] === '') return roundDecimal(value);
  return {
    value: whole + best[0],
    text: `${whole > 0 ? whole : ''}${best[1]}`,
  };
}

function roundDecimal(value: number): Rounded {
  let rounded: number;
  if (value >= 100) rounded = Math.round(value / 5) * 5;
  else if (value >= 10) rounded = Math.round(value);
  else if (value >= 1) rounded = Math.round(value * 10) / 10;
  else rounded = Math.round(value * 100) / 100 || Number(value.toPrecision(1));
  return { value: rounded, text: String(rounded) };
}

/** The value as it will be displayed, e.g. for choosing "cup" vs "cups". */
export function displayedValue(
  value: number,
  style: QuantityStyle = 'fraction',
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return (style === 'decimal' ? roundDecimal(value) : roundFraction(value))
    .value;
}

/**
 * Format a quantity for display.
 * - `fraction`: nearest kitchen fraction (⅛ steps plus thirds) — for cups/spoons/counts.
 * - `decimal`: sensible rounding — for metric weights and volumes.
 */
export function formatQuantity(
  value: number,
  style: QuantityStyle = 'fraction',
): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return (style === 'decimal' ? roundDecimal(value) : roundFraction(value))
    .text;
}

export function formatRange(
  min: number,
  max: number | undefined,
  style: QuantityStyle = 'fraction',
): string {
  const a = formatQuantity(min, style);
  if (max === undefined) return a;
  const b = formatQuantity(max, style);
  return a === b ? a : `${a}–${b}`;
}
