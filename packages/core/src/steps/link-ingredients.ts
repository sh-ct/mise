import {
  allIngredients,
  type Ingredient,
  type RecipeDraft,
  type Step,
} from '../schema/recipe.ts';
import { singular, words } from '../text/normalize.ts';
import { UNITS } from '../units/units.ts';

// Words that describe an ingredient rather than name it, stripped before matching step text.
// Count units ("clove", "tin") are included because "2 garlic cloves" is about garlic.
const DESCRIPTORS = new Set([
  ...(
    'fresh freshly large small medium big extra virgin finely roughly coarsely thinly thickly chopped diced ' +
    'sliced minced grated ground crushed peeled deseeded seeded pitted halved quartered trimmed boneless ' +
    'skinless unsalted salted ripe dried whole plain all purpose organic free range good quality cold warm ' +
    'hot room temperature softened melted packed light heaped level rounded of the a an for to some about ' +
    'approx approximately optional shop bought store homemade frozen tinned canned raw cooked leftover ' +
    'beaten lightly well firmly'
  ).split(' '),
  ...UNITS.filter((u) => u.dimension === 'count').flatMap((u) => [
    u.singular,
    u.plural,
  ]),
]);

// Too generic to identify an ingredient on their own: also verbs, colours or modifiers ("brown the
// onions", "cream the butter", "sea salt"). Still matched as part of a full name like "brown sugar".
const WEAK_ALONE = new Set(
  (
    'brown white red green black yellow golden cream baking sweet smoked sea spring caster icing double ' +
    'single heavy whipping sour dark stock'
  ).split(' '),
);

/** full: the whole name ("chicken thigh"); head: its last word ("thigh"); part: another word ("chicken"). */
type PhraseKind = 'full' | 'head' | 'part';
const RANK: Record<PhraseKind, number> = { full: 3, head: 2, part: 1 };

interface Phrase {
  words: string[];
  kind: PhraseKind;
  ingredientId: string;
}

function phrasesFor(ingredient: Pick<Ingredient, 'id' | 'item'>): Phrase[] {
  // "salt and pepper" → two things to look for
  const parts = ingredient.item
    .replace(/\([^()]*\)/g, ' ')
    .split(/\s+(?:and|or|&)\s+|\//i);
  const out: Phrase[] = [];
  for (const part of parts) {
    const keyWords = words(part)
      .filter((w) => !DESCRIPTORS.has(w) && !/^\d/.test(w))
      .map(singular);
    if (keyWords.length === 0) continue;
    out.push({ words: keyWords, kind: 'full', ingredientId: ingredient.id });
    if (keyWords.length > 1) {
      keyWords.forEach((word, i) => {
        const kind: PhraseKind = i === keyWords.length - 1 ? 'head' : 'part';
        if (kind === 'part' && WEAK_ALONE.has(word)) return;
        out.push({ words: [word], kind, ingredientId: ingredient.id });
      });
    }
  }
  return out;
}

interface StepWord {
  word: string;
  sentenceStart: boolean;
}

function stepWords(text: string): StepWord[] {
  const out: StepWord[] = [];
  let lastEnd = 0;
  for (const m of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)) {
    out.push({
      word: singular(m[0]),
      sentenceStart:
        out.length === 0 || /[.!?;:]/.test(text.slice(lastEnd, m.index)),
    });
    lastEnd = m.index + m[0].length;
  }
  return out;
}

/**
 * Guesses which ingredients a step uses by finding ingredient names in its text. Build once per recipe
 * and call `link` for each step.
 *
 * - Longest names are matched first and "consume" their words, so "brown sugar" isn't also read as "sugar".
 * - A single word of a longer name links it too: the head noun ("thighs") or another word ("chicken"),
 *   except generic words ("brown", "sea"). A generic word that is a whole name ("cream") doesn't link when
 *   it starts a sentence, where it's usually a verb ("Cream the butter").
 * - When several ingredients share a matched word, the strongest kind wins (full name > head > other word);
 *   ties are all linked and the user can untick extras in the editor.
 */
export class IngredientLinker {
  private readonly groups: Phrase[][];

  constructor(
    private readonly ingredients: readonly Pick<Ingredient, 'id' | 'item'>[],
  ) {
    const byKey = new Map<string, Phrase[]>();
    for (const phrase of ingredients.flatMap(phrasesFor)) {
      const key = phrase.words.join(' ');
      byKey.set(key, [...(byKey.get(key) ?? []), phrase]);
    }
    this.groups = [...byKey.values()].sort(
      (a, b) => (b[0]?.words.length ?? 0) - (a[0]?.words.length ?? 0),
    );
  }

  link(stepText: string): string[] {
    const tokens = stepWords(stepText);
    const positions = new Map<string, number[]>();
    tokens.forEach((t, i) =>
      positions.set(t.word, [...(positions.get(t.word) ?? []), i]),
    );
    const consumed = new Array<boolean>(tokens.length).fill(false);

    const linked = new Set<string>();
    for (const group of this.groups) {
      const target = group[0]?.words ?? [];
      const weak = target.length === 1 && WEAK_ALONE.has(target[0] ?? '');
      let found = false;
      for (const i of positions.get(target[0] ?? '') ?? []) {
        if (weak && tokens[i]?.sentenceStart) continue;
        if (
          !target.every((w, j) => tokens[i + j]?.word === w && !consumed[i + j])
        )
          continue;
        for (let j = 0; j < target.length; j++) consumed[i + j] = true;
        found = true;
      }
      if (!found) continue;
      const best = group.reduce((max, p) => Math.max(max, RANK[p.kind]), 0);
      for (const p of group)
        if (RANK[p.kind] === best) linked.add(p.ingredientId);
    }

    // Keep recipe order.
    return this.ingredients.filter((i) => linked.has(i.id)).map((i) => i.id);
  }
}

/** One-off convenience for a single step; use `IngredientLinker` when linking many steps. */
export function linkStepIngredients(
  stepText: string,
  ingredients: readonly Pick<Ingredient, 'id' | 'item'>[],
): string[] {
  return new IngredientLinker(ingredients).link(stepText);
}

/**
 * Fill in `ingredientRefs` for steps that have none (e.g. after an import). Steps the user already
 * linked are left untouched.
 */
export function autoLinkDraft(draft: RecipeDraft): RecipeDraft {
  const linker = new IngredientLinker(allIngredients(draft));
  const link = (step: Step): Step =>
    step.ingredientRefs.length > 0
      ? step
      : {
          ...step,
          ingredientRefs: linker
            .link(step.text)
            .map((ingredientId) => ({ ingredientId, amountFraction: 1 })),
        };
  return {
    ...draft,
    stepSections: draft.stepSections.map((section) => ({
      ...section,
      steps: section.steps.map(link),
    })),
  };
}
