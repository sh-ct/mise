import { detectDurations } from './durations';
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
 * Timers take precedence; a glossary term inside a timer's text is skipped and its next mention used.
 */
export function enrichStep(
  text: string,
  options: EnrichOptions = {},
): StepSegment[] {
  const timers = detectDurations(text);
  const terms =
    options.glossary?.match(text, {
      suppress: options.glossarySuppress,
      exclude: timers,
    }) ?? [];

  const spans = [
    ...timers.map((t) => ({ ...t, kind: 'timer' as const })),
    ...terms.map((g) => ({ ...g, kind: 'glossary' as const })),
  ].sort((a, b) => a.start - b.start);

  const segments: StepSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor)
      segments.push({ kind: 'text', text: text.slice(cursor, span.start) });
    segments.push(
      span.kind === 'timer'
        ? {
            kind: 'timer',
            text: span.text,
            minSeconds: span.minSeconds,
            maxSeconds: span.maxSeconds,
          }
        : { kind: 'glossary', text: span.text, slug: span.slug },
    );
    cursor = span.end;
  }
  if (cursor < text.length)
    segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}
