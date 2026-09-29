import { parseNumber } from '../quantity/quantity';

export interface DurationMatch {
  start: number;
  end: number;
  text: string;
  /** Lower bound in seconds. Timers start here (ADR 0005). */
  minSeconds: number;
  /** Upper bound for ranges ("10–12 minutes"), otherwise equal to minSeconds. */
  maxSeconds: number;
}

const VULGAR = '½¼¾⅓⅔⅛⅜⅝⅞';
const NUM = `(?:\\d+\\s*[${VULGAR}]|\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?|[${VULGAR}]|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|forty-five|sixty|ninety|a couple of|a few|several)`;
const UNIT = `(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)`;
const RANGE = `\\s*(?:-|–|—|to|or)\\s*`;
// "half an hour" / "an hour and a half" / "1½ hours" are handled; "overnight" and "until golden" are not durations.
const HALF_AN_HOUR = /\bhalf\s+an?\s+hour\b/giu;
const PART = new RegExp(
  `(?<![\\p{L}\\p{N}])(${NUM})(?:${RANGE}(${NUM}))?[\\s-]*${UNIT}(?![\\p{L}])(\\s+and\\s+a\\s+half)?`,
  'giu',
);

const WORD_NUMBERS: Record<string, number> = {
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
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  'forty-five': 45,
  sixty: 60,
  ninety: 90,
  'a couple of': 2,
  'a few': 3,
  several: 3,
};

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('m')) return 60;
  return 1;
}

function numberValue(text: string): number | undefined {
  const t = text.toLowerCase().trim();
  return WORD_NUMBERS[t] ?? parseNumber(t);
}

interface Part extends DurationMatch {
  unitRank: number;
}

/**
 * Find cooking durations in step text: "25 minutes", "1 hr 15 mins", "10–12 mins", "1½ hours",
 * "half an hour", "an hour and a half", "20-minute rest". Single-letter units ("10m", "1h30") are only
 * accepted directly after digits, to avoid matching ordinary words.
 */
export function detectDurations(text: string): DurationMatch[] {
  const parts: Part[] = [];

  for (const m of text.matchAll(HALF_AN_HOUR)) {
    parts.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      minSeconds: 1800,
      maxSeconds: 1800,
      unitRank: 3600,
    });
  }
  const halves = [...parts];

  for (const m of text.matchAll(PART)) {
    const [whole, a = '', b, unit = '', andAHalf] = m;
    const start = m.index;
    if (halves.some((h) => start < h.end && start + whole.length > h.start))
      continue;
    if (unit.length === 1 && !/^\d+$/.test(a)) continue; // "a m", "one s"
    if (
      unit.length === 1 &&
      /\s/.test(
        whole.slice(
          a.length,
          whole.length - unit.length - (andAHalf?.length ?? 0),
        ),
      )
    )
      continue; // "5 m"
    const per = unitSeconds(unit);
    const min = numberValue(a);
    if (min === undefined || min <= 0) continue;
    const max = b !== undefined ? numberValue(b) : undefined;
    const half = andAHalf ? 0.5 : 0;
    parts.push({
      start,
      end: start + whole.length,
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
  // ("10 minutes to 12 minutes").
  const merged: Part[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const gap = text.slice(prev.end, part.start);
      if (/^\s*(?:,|and)?\s*$/.test(gap) && part.unitRank < prev.unitRank) {
        prev.minSeconds += part.minSeconds;
        prev.maxSeconds += part.maxSeconds;
        prev.end = part.end;
        prev.text = text.slice(prev.start, prev.end);
        prev.unitRank = part.unitRank;
        continue;
      }
      if (
        /^\s*(?:-|–|—|to|or)\s*$/.test(gap) &&
        part.minSeconds > prev.maxSeconds
      ) {
        prev.maxSeconds = part.maxSeconds;
        prev.end = part.end;
        prev.text = text.slice(prev.start, prev.end);
        continue;
      }
    }
    merged.push({ ...part });
  }

  // "1h30" — trailing bare minutes after an hour with a single-letter unit
  for (const p of merged) {
    const tail = /^(\d{1,2})(?![\p{L}\p{N}])/u.exec(text.slice(p.end));
    if (tail && /\dh$/i.test(p.text)) {
      const mins = Number(tail[1]);
      p.minSeconds += mins * 60;
      p.maxSeconds += mins * 60;
      p.end += tail[0].length;
      p.text = text.slice(p.start, p.end);
    }
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

/** "1:05:00", "4:59", "0:07" — countdown clock. Negative values (overrun) get a leading "+". */
export function formatClock(seconds: number): string {
  const over = seconds < 0;
  const s = Math.abs(Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  return over ? `+${body}` : body;
}
