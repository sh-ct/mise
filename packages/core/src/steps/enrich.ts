import { detectDurations, type DurationMatch } from './durations';
import type { GlossaryMatcher } from './glossary';

export type StepSegment =
  | { kind: 'text'; text: string }
  | { kind: 'timer'; text: string; minSeconds: number; maxSeconds: number }
  | { kind: 'glossary'; text: string; slug: string };

export interface EnrichOptions {
  glossary?: GlossaryMatcher;
  /** Glossary slugs not to link in this step. */
  glossarySuppress?: readonly string[];
}

/**
 * Split step prose into renderable segments: plain text, tappable timers and glossary terms.
 * Timers win when a timer and a glossary term overlap.
 */
export function enrichStep(
  text: string,
  options: EnrichOptions = {},
): StepSegment[] {
  const timers: Array<DurationMatch & { kind: 'timer' }> = detectDurations(
    text,
  ).map((d) => ({ ...d, kind: 'timer' }));
  const terms = (
    options.glossary?.match(text, {
      suppress: options.glossarySuppress ?? [],
    }) ?? []
  )
    .filter((g) => !timers.some((t) => g.start < t.end && g.end > t.start))
    .map((g) => ({ ...g, kind: 'glossary' as const }));

  const spans = [...timers, ...terms].sort((a, b) => a.start - b.start);
  const segments: StepSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor)
      segments.push({ kind: 'text', text: text.slice(cursor, span.start) });
    if (span.kind === 'timer') {
      segments.push({
        kind: 'timer',
        text: span.text,
        minSeconds: span.minSeconds,
        maxSeconds: span.maxSeconds,
      });
    } else {
      segments.push({ kind: 'glossary', text: span.text, slug: span.slug });
    }
    cursor = span.end;
  }
  if (cursor < text.length)
    segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}
