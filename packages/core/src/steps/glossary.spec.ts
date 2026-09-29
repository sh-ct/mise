import { enrichStep } from './enrich';
import { GlossaryMatcher, type GlossaryTerm } from './glossary';

const TERMS: GlossaryTerm[] = [
  {
    slug: 'sous-vide',
    term: 'sous vide',
    definition: 'Cooking sealed food in a precisely heated water bath.',
  },
  {
    slug: 'fold',
    term: 'fold',
    definition: 'Gently combine without knocking out air.',
    matchRules: { excludeNear: ['pastry', 'dough', 'half', 'over', 'napkin'] },
  },
  {
    slug: 'reduce',
    term: 'reduce',
    definition: 'Simmer uncovered until thickened.',
    matchRules: { excludeNear: ['heat', 'temperature', 'oven', 'speed'] },
  },
  {
    slug: 'deglaze',
    term: 'deglaze',
    aliases: ['de-glaze'],
    definition: 'Loosen browned bits with liquid.',
  },
  { slug: 'chop', term: 'chop', definition: 'Cut into pieces.' },
  {
    slug: 'vide',
    term: 'vide',
    definition: 'Decoy term to prove longest match wins.',
  },
];

const matcher = new GlossaryMatcher(TERMS);
const slugs = (text: string, suppress: string[] = []) =>
  matcher.match(text, { suppress }).map((m) => [m.slug, m.text]);

describe('GlossaryMatcher', () => {
  it('matches whole words case-insensitively', () => {
    expect(slugs('Deglaze the pan with wine.')).toEqual([
      ['deglaze', 'Deglaze'],
    ]);
    expect(slugs('Unfolded towels.')).toEqual([]);
  });

  it('treats spaces and hyphens alike', () => {
    expect(slugs('Cook the steak sous-vide for 2 hours.')).toEqual([
      ['sous-vide', 'sous-vide'],
    ]);
    expect(slugs('Cook the steak sous vide.')).toEqual([
      ['sous-vide', 'sous vide'],
    ]);
  });

  it('prefers the longest phrase', () => {
    expect(slugs('Sous vide the eggs.')).toEqual([['sous-vide', 'Sous vide']]);
  });

  it('matches simple inflections', () => {
    expect(slugs('Gently folding in the flour.')).toEqual([
      ['fold', 'folding'],
    ]);
    expect(slugs('Once reduced by half, season.')).toEqual([
      ['reduce', 'reduced'],
    ]);
    expect(slugs('Chopped herbs.')).toEqual([['chop', 'Chopped']]);
  });

  it('applies exclusion rules for ambiguous words', () => {
    expect(slugs('Reduce the heat to low.')).toEqual([]);
    expect(slugs('Fold the pastry in half.')).toEqual([]);
    expect(slugs('Reduce the sauce until glossy.')).toEqual([
      ['reduce', 'Reduce'],
    ]);
  });

  it('only underlines the first valid mention per step', () => {
    const matches = matcher.match(
      'Reduce the heat, then reduce the sauce and reduce again.',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.start).toBe('Reduce the heat, then '.length);
  });

  it('respects per-step suppression', () => {
    expect(slugs('Fold in the egg whites.', ['fold'])).toEqual([]);
  });

  it('supports requireNear', () => {
    const m = new GlossaryMatcher([
      {
        slug: 'cream',
        term: 'cream',
        definition: 'Beat until light.',
        matchRules: { requireNear: ['butter', 'sugar'] },
      },
    ]);
    expect(m.match('Cream the butter and sugar.').map((x) => x.slug)).toEqual([
      'cream',
    ]);
    expect(m.match('Pour over the cream.')).toEqual([]);
  });
});

describe('enrichStep', () => {
  it('splits text into timers, glossary terms and text', () => {
    expect(
      enrichStep('Deglaze with stock and simmer for 10-12 minutes.', {
        glossary: matcher,
      }),
    ).toEqual([
      { kind: 'glossary', text: 'Deglaze', slug: 'deglaze' },
      { kind: 'text', text: ' with stock and simmer for ' },
      {
        kind: 'timer',
        text: '10-12 minutes',
        minSeconds: 600,
        maxSeconds: 720,
      },
      { kind: 'text', text: '.' },
    ]);
  });

  it('returns a single text segment when there is nothing to enrich', () => {
    expect(enrichStep('Serve.')).toEqual([{ kind: 'text', text: 'Serve.' }]);
  });

  it('passes suppression through', () => {
    expect(
      enrichStep('Fold gently.', {
        glossary: matcher,
        glossarySuppress: ['fold'],
      }),
    ).toEqual([{ kind: 'text', text: 'Fold gently.' }]);
  });

  it('round-trips the original text', () => {
    const text =
      'Chop the onion, sous vide at 60C for 1 hr 30 mins, then reduce the sauce.';
    expect(
      enrichStep(text, { glossary: matcher })
        .map((s) => s.text)
        .join(''),
    ).toBe(text);
  });
});
