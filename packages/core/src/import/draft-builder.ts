import { newId, type IdFactory } from '../ids';
import { toIngredient } from '../ingredients/parse-ingredient';
import { detectUnitSystem } from '../ingredients/unit-system';
import {
  LIMITS,
  allIngredients,
  type RecipeDraft,
  type SourceType,
} from '../schema/recipe';
import { autoLinkDraft } from '../steps/link-ingredients';

export interface RawSection {
  title?: string;
  lines: string[];
}

/** Loosely-typed recipe pieces extracted by an importer, before parsing into a `RecipeDraft`. */
export interface RawRecipe {
  title?: string;
  description?: string;
  servings?: number;
  yieldText?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceAttribution?: string;
  heroImageUrl?: string;
  tags?: string[];
  ingredientSections: RawSection[];
  stepSections: RawSection[];
}

/** Trim and cap to `max` characters, marking the cut. */
function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function inRange(n: number | undefined, max: number): number | undefined {
  return n !== undefined && Number.isFinite(n) && n > 0 && n <= max
    ? n
    : undefined;
}

const minutes = (n: number | undefined) => {
  const m = inRange(n, LIMITS.minutes);
  return m === undefined ? undefined : Math.round(m);
};

const webUrl = (s: string | undefined) =>
  s && s.length <= LIMITS.url && /^https?:\/\/\S+$/i.test(s) ? s : undefined;

/**
 * Normalise sections: clip titles and lines, drop empty ones, and stop once `maxItems` lines have been
 * taken across all sections (imports are untrusted and may be huge).
 */
function sections(
  raw: RawSection[],
  maxItems: number,
  maxLine: number,
): Array<{ title?: string; lines: string[] }> {
  let budget = maxItems;
  return raw
    .slice(0, LIMITS.sections)
    .map((s) => {
      const lines = s.lines
        .map((l) => clip(l, maxLine))
        .filter((l): l is string => !!l)
        .slice(0, Math.max(0, budget));
      budget -= lines.length;
      const title = clip(s.title, LIMITS.sectionTitle);
      return { ...(title && { title }), lines };
    })
    .filter((s) => s.lines.length > 0);
}

/**
 * Turn raw extracted pieces into a `RecipeDraft`: parse ingredient lines, detect the unit system and
 * auto-link steps to ingredients. The result is for review in the editor, so it keeps text rather than
 * discarding it, but everything is clipped to `LIMITS` so it validates and can be saved.
 */
export function buildDraft(
  raw: RawRecipe,
  idFactory: IdFactory = newId,
): RecipeDraft {
  const ingredientSections = sections(
    raw.ingredientSections,
    LIMITS.ingredients,
    LIMITS.rawText,
  ).map((s) => ({
    id: idFactory(),
    ...(s.title && { title: s.title }),
    ingredients: s.lines.map((line) => {
      const { prepNote, note, ...ingredient } = toIngredient(line, idFactory);
      const clippedPrep = clip(prepNote, LIMITS.prepNote);
      const clippedNote = clip(note, LIMITS.note);
      return {
        ...ingredient,
        item: clip(ingredient.item, LIMITS.item) ?? ingredient.item,
        ...(clippedPrep && { prepNote: clippedPrep }),
        ...(clippedNote && { note: clippedNote }),
      };
    }),
  }));
  const stepSections = sections(
    raw.stepSections,
    LIMITS.steps,
    LIMITS.stepText,
  ).map((s) => ({
    id: idFactory(),
    ...(s.title && { title: s.title }),
    steps: s.lines.map((text) => ({
      id: idFactory(),
      text,
      glossarySuppress: [],
      ingredientRefs: [],
    })),
  }));

  const tags = [
    ...new Map(
      (raw.tags ?? [])
        .map((t) => t.trim())
        .filter((t) => t && t.length <= LIMITS.tag)
        .map((t) => [t.toLowerCase(), t]),
    ).values(),
  ].slice(0, 12);

  const title = clip(raw.title, LIMITS.title);
  const description = clip(raw.description, LIMITS.description);
  const yieldText = clip(raw.yieldText, LIMITS.yieldText);
  const sourceAttribution = clip(raw.sourceAttribution, LIMITS.attribution);
  const servings = inRange(raw.servings, LIMITS.servings);
  const prepMinutes = minutes(raw.prepMinutes);
  const cookMinutes = minutes(raw.cookMinutes);
  const totalMinutes = minutes(raw.totalMinutes);
  const sourceUrl = webUrl(raw.sourceUrl);
  const heroImageUrl = webUrl(raw.heroImageUrl);

  const draft: RecipeDraft = {
    id: idFactory(),
    title: title ?? 'Untitled recipe',
    ...(description && { description }),
    ...(servings !== undefined && { servings }),
    ...(yieldText && { yieldText }),
    ...(prepMinutes !== undefined && { prepMinutes }),
    ...(cookMinutes !== undefined && { cookMinutes }),
    ...(totalMinutes !== undefined && { totalMinutes }),
    sourceType: raw.sourceType,
    ...(sourceUrl && { sourceUrl }),
    ...(sourceAttribution && { sourceAttribution }),
    ...(heroImageUrl && { heroImageUrl }),
    unitSystem: 'mixed',
    ingredientSections: ingredientSections.length
      ? ingredientSections
      : [{ id: idFactory(), ingredients: [] }],
    stepSections: stepSections.length
      ? stepSections
      : [{ id: idFactory(), steps: [] }],
    tags,
  };
  draft.unitSystem = detectUnitSystem(allIngredients(draft));
  return autoLinkDraft(draft);
}
