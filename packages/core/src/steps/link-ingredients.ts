import type { Ingredient, RecipeDraft, Step } from '../schema/recipe';
import { singular, words } from '../text/normalize';

// Words that describe an ingredient rather than name it. Stripped before matching step text.
const DESCRIPTORS = new Set(
  (
    'fresh freshly large small medium big extra virgin finely roughly coarsely thinly thickly chopped diced ' +
    'sliced minced grated ground crushed peeled deseeded seeded pitted halved quartered trimmed boneless ' +
    'skinless unsalted salted ripe dried whole plain all purpose organic free range good quality cold warm ' +
    'hot room temperature softened melted packed light heaped level rounded of the a an for to some about ' +
    'approx approximately piece pieces handful bunch can tin jar cans tins jars pinch dash optional ' +
    'shop bought store homemade frozen tinned canned raw cooked leftover beaten lightly well firmly'
  ).split(' '),
);

// Words that are poor evidence on their own because they're also verbs or colours ("brown the onions",
// "cream the butter"). Still matched as part of a full name like "brown sugar".
const WEAK_ALONE = new Set(
  'brown white red green black yellow golden cream baking sweet smoked sea spring caster icing double single heavy whipping sour dark stock'.split(
    ' ',
  ),
);

/** full: the whole name ("chicken thigh"); head: its last word ("thigh"); part: another word ("chicken"). */
type PhraseKind = 'full' | 'head' | 'part';
const RANK: Record<PhraseKind, number> = { full: 3, head: 2, part: 1 };

interface Phrase {
  key: string;
  words: string[];
  kind: PhraseKind;
  ingredientId: string;
}

function phrasesFor(ingredient: Pick<Ingredient, 'id' | 'item'>): Phrase[] {
  // "salt and pepper" → two things to look for
  const parts = ingredient.item
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+(?:and|or|&)\s+|\//i);
  const out: Phrase[] = [];
  for (const part of parts) {
    const keyWords = words(part)
      .filter((w) => !DESCRIPTORS.has(w) && !/^\d/.test(w))
      .map(singular);
    if (keyWords.length === 0) continue;
    out.push({
      key: keyWords.join(' '),
      words: keyWords,
      kind: 'full',
      ingredientId: ingredient.id,
    });
    if (keyWords.length > 1) {
      keyWords.forEach((word, i) => {
        const kind: PhraseKind = i === keyWords.length - 1 ? 'head' : 'part';
        if (kind === 'part' && WEAK_ALONE.has(word)) return;
        out.push({
          key: word,
          words: [word],
          kind,
          ingredientId: ingredient.id,
        });
      });
    }
  }
  return out;
}

/**
 * Guess which ingredients each step uses by finding ingredient names in the step text.
 *
 * - Longest names are matched first and "consume" their words, so "brown sugar" isn't also read as "sugar".
 * - A single word of a longer name links it too: the head noun ("thighs") or another word ("chicken"),
 *   except words that are also verbs/colours ("brown", "cream").
 * - When several ingredients share a matched word, the strongest kind wins (full name > head > other word);
 *   ties are all linked and the user can untick extras in the editor.
 */
export function linkStepIngredients(
  stepText: string,
  ingredients: readonly Pick<Ingredient, 'id' | 'item'>[],
): string[] {
  const stepWords = words(stepText).map(singular);
  const consumed = new Array<boolean>(stepWords.length).fill(false);

  const groups = new Map<string, Phrase[]>();
  for (const phrase of ingredients.flatMap(phrasesFor)) {
    const group = groups.get(phrase.key) ?? [];
    group.push(phrase);
    groups.set(phrase.key, group);
  }
  const ordered = [...groups.values()].sort(
    (a, b) => (b[0]?.words.length ?? 0) - (a[0]?.words.length ?? 0),
  );

  const linked = new Set<string>();
  for (const group of ordered) {
    const target = group[0]?.words ?? [];
    let found = false;
    for (let i = 0; i + target.length <= stepWords.length; i++) {
      if (target.every((w, j) => stepWords[i + j] === w && !consumed[i + j])) {
        for (let j = 0; j < target.length; j++) consumed[i + j] = true;
        found = true;
      }
    }
    if (!found) continue;
    const best = Math.max(...group.map((p) => RANK[p.kind]));
    for (const p of group)
      if (RANK[p.kind] === best) linked.add(p.ingredientId);
  }

  // Keep recipe order.
  return ingredients.filter((i) => linked.has(i.id)).map((i) => i.id);
}

/**
 * Fill in `ingredientRefs` for steps that have none (e.g. after an import). Steps the user already
 * linked are left untouched.
 */
export function autoLinkDraft(draft: RecipeDraft): RecipeDraft {
  const ingredients = draft.ingredientSections.flatMap((s) => s.ingredients);
  const link = (step: Step): Step =>
    step.ingredientRefs.length > 0
      ? step
      : {
          ...step,
          ingredientRefs: linkStepIngredients(step.text, ingredients).map(
            (ingredientId) => ({ ingredientId, amountFraction: 1 }),
          ),
        };
  return {
    ...draft,
    stepSections: draft.stepSections.map((section) => ({
      ...section,
      steps: section.steps.map(link),
    })),
  };
}
