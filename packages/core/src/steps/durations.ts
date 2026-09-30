import {
  NUMBER_PATTERN,
  NUMBER_WORDS,
  RANGE_SEPARATOR_PATTERN,
  parseNumber,
} from '../quantity/quantity';
import { overlaps, type TextSpan } from '../text/normalize';
import { matchUnitPrefix } from '../units/units';

export interface DurationMatch extends TextSpan {
  /** Lower bound in seconds. Timers start here (ADR 0005). */
  minSeconds: number;
  /** Upper bound for ranges ("10–12 minutes"), otherwise equal to minSeconds. */
  maxSeconds: number;
}

const DURATION_WORDS = new Map<string, number>([
  ...NUMBER_WORDS,
  ['fifteen', 15],
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['forty-five', 45],
  ['sixty', 60],
  ['ninety', 90],
  ['a couple of', 2],
  ['a few', 3],
  ['several', 3],
]);
// "a second bowl" and "one second thought" are not timers.
const SINGULAR_WORDS = new Set(['a', 'an', 'one']);

const WORDS = [...DURATION_WORDS.keys()]
  .sort((a, b) => b.length - a.length)
  .join('|');
const NUM = `(?:${NUMBER_PATTERN}|${WORDS})`;
const UNIT = `(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)`;
const PART = new RegExp(
  `(?<![\\p{L}\\p{N}])(${NUM})(?:${RANGE_SEPARATOR_PATTERN}(${NUM}))?[\\s-]*${UNIT}(?![\\p{L}])(\\s+and\\s+a\\s+half)?`,
  'giu',
);
const HALF_AN_HOUR = /\bhalf\s+an?\s+hour\b/giu;
const RANGE_GAP = new RegExp(`^${RANGE_SEPARATOR_PATTERN}$`);

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('m')) return 60;
  return 1;
}

function numberValue(text: string): number | undefined {
  const t = text.toLowerCase().trim();
  return DURATION_WORDS.get(t) ?? parseNumber(t);
}

interface Part extends DurationMatch {
  /** Seconds per unit of the smallest unit in this part, so compounds only merge downwards. */
  unitRank: number;
}

/**
 * Find cooking durations in step text: "25 minutes", "1 hr 15 mins", "1 hr 15", "10–12 mins", "1½ hours",
 * "half an hour", "an hour and a half", "20-minute rest". Single-letter units ("10m", "1h30") are only
 * accepted directly after digits, to avoid matching ordinary words.
 */
export function detectDurations(text: string): DurationMatch[] {
  const parts: Part[] = [...text.matchAll(HALF_AN_HOUR)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    text: m[0],
    minSeconds: 1800,
    maxSeconds: 1800,
    unitRank: 3600,
  }));
  const halves = [...parts];

  for (const m of text.matchAll(PART)) {
    const [whole, a = '', b, unit = '', andAHalf] = m;
    const span = { start: m.index, end: m.index + whole.length };
    if (halves.some((h) => overlaps(h, span))) continue;
    const per = unitSeconds(unit);
    if (per === 1 && SINGULAR_WORDS.has(a.toLowerCase())) continue;
    if (unit.length === 1) {
      // "10m", "1h" only: not "a m" or "5 m strips"
      const between = whole.slice(
        a.length,
        whole.length - unit.length - (andAHalf?.length ?? 0),
      );
      if (!/^\d+$/.test(a) || /\s/.test(between)) continue;
    }
    const min = numberValue(a);
    if (min === undefined || min <= 0) continue;
    const max = b !== undefined ? numberValue(b) : undefined;
    const half = andAHalf ? 0.5 : 0;
    parts.push({
      ...span,
      text: whole,
      minSeconds: Math.round((min + half) * per),
      maxSeconds: Math.round(
        ((max !== undefined && max > min ? max : min) + half) * per,
      ),
      unitRank: per,
    });
  }

  parts.sort((x, y) => x.start - y.start);

  // Merge compounds ("1 hour 15 minutes", "1 hr and 15 mins", "1h30m") and unit-repeated ranges
  // ("10 minutes to 12 minutes"). A comma separates durations: "2 hours, 10 minutes before serving".
  const merged: Part[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    const gap = prev ? text.slice(prev.end, part.start) : '';
    if (prev && /^\s*(?:and)?\s*$/.test(gap) && part.unitRank < prev.unitRank) {
      prev.minSeconds += part.minSeconds;
      prev.maxSeconds += part.maxSeconds;
      prev.end = part.end;
      prev.text = text.slice(prev.start, prev.end);
      prev.unitRank = part.unitRank;
    } else if (
      prev &&
      RANGE_GAP.test(gap) &&
      part.minSeconds > prev.maxSeconds
    ) {
      prev.maxSeconds = part.maxSeconds;
      prev.end = part.end;
      prev.text = text.slice(prev.start, prev.end);
    } else {
      merged.push({ ...part });
    }
  }

  // Bare minutes after hours: "1h30", "1 hr 15", "1h 30 then rest" — but not "1 hour 2 cups".
  for (const p of merged) {
    if (p.unitRank !== 3600) continue;
    const tail = /^\s?(\d{1,2})(?![\p{N}/]|[.,]\p{N})/u.exec(text.slice(p.end));
    const minutes = Number(tail?.[1]);
    if (
      !tail ||
      minutes >= 60 ||
      matchUnitPrefix(text.slice(p.end + tail[0].length).trimStart())
    )
      continue;
    p.minSeconds += minutes * 60;
    p.maxSeconds += minutes * 60;
    p.end += tail[0].length;
    p.text = text.slice(p.start, p.end);
  }

  return merged.map(({ unitRank: _unitRank, ...m }) => m);
}

/** "1 h 5 min", "25 min", "45 s" — compact label for a timer chip. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const out: string[] = [];
  if (h) out.push(`${h} h`);
  if (m) out.push(`${m} min`);
  if (sec || out.length === 0) out.push(`${sec} s`);
  return out.join(' ');
}
