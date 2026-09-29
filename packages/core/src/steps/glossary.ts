import { escapeRegExp, words } from '../text/normalize';

export interface GlossaryMatchRules {
  /** Only match if one of these words appears within `window` words after the term. */
  requireNear?: string[];
  /** Don't match if one of these words appears within `window` words after the term ("reduce the heat"). */
  excludeNear?: string[];
  /** Words after the term to inspect. Default 3. */
  window?: number;
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  aliases?: string[];
  definition: string;
  matchRules?: GlossaryMatchRules;
  /** Plain-language rewrite for a future "simplify" mode. */
  plainPhrasing?: string;
}

export interface GlossaryMatch {
  start: number;
  end: number;
  text: string;
  slug: string;
}

interface Phrase {
  pattern: RegExp;
  length: number;
  term: GlossaryTerm;
}

/**
 * Pre-compiled glossary matcher. Build once per glossary (it's global) and reuse for every step.
 *
 * - Case-insensitive, whole-word; spaces and hyphens are interchangeable ("sous vide" = "sous-vide").
 * - Simple inflections of the last word: fold → folds/folded/folding, reduce → reduced/reducing,
 *   chop → chopped/chopping.
 * - Longest phrase wins; matches never overlap.
 * - First mention per step only; slugs in `suppress` are skipped.
 */
export class GlossaryMatcher {
  private readonly phrases: Phrase[];

  constructor(terms: readonly GlossaryTerm[]) {
    this.phrases = terms
      .flatMap((term) =>
        [term.term, ...(term.aliases ?? [])].map((phrase) => ({
          phrase,
          term,
        })),
      )
      .filter(({ phrase }) => phrase.trim().length > 0)
      .map(({ phrase, term }) => ({
        pattern: new RegExp(
          `(?<![\\p{L}\\p{N}])${phrasePattern(phrase)}(?![\\p{L}\\p{N}])`,
          'giu',
        ),
        length: phrase.length,
        term,
      }))
      .sort((a, b) => b.length - a.length);
  }

  match(
    text: string,
    options: { suppress?: readonly string[] } = {},
  ): GlossaryMatch[] {
    const suppress = new Set(options.suppress ?? []);

    // Every candidate occurrence, longest phrase first (then leftmost), claimed greedily so
    // "sous vide" beats "vide" and matches never overlap.
    const candidates: GlossaryMatch[] = [];
    for (const { pattern, term } of this.phrases) {
      if (suppress.has(term.slug)) continue;
      for (const m of text.matchAll(pattern)) {
        const end = m.index + m[0].length;
        if (passesRules(text, end, term.matchRules)) {
          candidates.push({ start: m.index, end, text: m[0], slug: term.slug });
        }
      }
    }
    candidates.sort(
      (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
    );

    const taken: GlossaryMatch[] = [];
    for (const c of candidates) {
      if (!taken.some((t) => c.start < t.end && c.end > t.start)) taken.push(c);
    }

    // First mention per slug.
    const first = new Map<string, GlossaryMatch>();
    for (const t of taken.sort((a, b) => a.start - b.start)) {
      if (!first.has(t.slug)) first.set(t.slug, t);
    }
    return [...first.values()];
  }
}

function phrasePattern(phrase: string): string {
  const parts = phrase
    .trim()
    .toLowerCase()
    .split(/[\s-]+/);
  const last = parts.pop() ?? '';
  const head = parts.map(escapeRegExp);
  let tail: string;
  if (last.length < 3 || !/^\p{L}+$/u.test(last)) tail = escapeRegExp(last);
  else if (last.endsWith('e'))
    tail = `${escapeRegExp(last.slice(0, -1))}(?:e|es|ed|ing)`;
  else
    tail = `${escapeRegExp(last)}(?:${escapeRegExp(last.slice(-1))})?(?:s|es|ed|ing)?`;
  return [...head, tail].join('[\\s-]+');
}

function passesRules(
  text: string,
  end: number,
  rules: GlossaryMatchRules | undefined,
): boolean {
  if (!rules) return true;
  const after = words(text.slice(end)).slice(0, rules.window ?? 3);
  const near = (list: string[]) =>
    list.some((w) => after.includes(w.toLowerCase()));
  if (rules.excludeNear?.length && near(rules.excludeNear)) return false;
  if (rules.requireNear?.length && !near(rules.requireNear)) return false;
  return true;
}
