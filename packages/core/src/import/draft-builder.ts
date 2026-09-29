import { newId, type IdFactory } from '../ids';
import { toIngredient } from '../ingredients/parse-ingredient';
import { detectUnitSystem } from '../ingredients/unit-system';
import type { RecipeDraft, SourceType } from '../schema/recipe';
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

const isUrl = (s: string | undefined): s is string =>
  !!s && /^https?:\/\/\S+$/i.test(s);

/**
 * Turn raw extracted pieces into a `RecipeDraft`: parse ingredient lines, drop empties, detect the
 * unit system and auto-link steps to ingredients. The result is for review in the editor, so it errs
 * on the side of keeping text rather than discarding it.
 */
export function buildDraft(
  raw: RawRecipe,
  idFactory: IdFactory = newId,
): RecipeDraft {
  const clean = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

  let ingredientSections = raw.ingredientSections
    .map((s) => ({
      title: s.title?.trim() || undefined,
      lines: clean(s.lines),
    }))
    .filter((s) => s.lines.length > 0)
    .map((s) => ({
      id: idFactory(),
      ...(s.title && { title: s.title }),
      ingredients: s.lines.map((line) => toIngredient(line, idFactory)),
    }));
  if (ingredientSections.length === 0)
    ingredientSections = [{ id: idFactory(), ingredients: [] }];

  let stepSections = raw.stepSections
    .map((s) => ({
      title: s.title?.trim() || undefined,
      lines: clean(s.lines),
    }))
    .filter((s) => s.lines.length > 0)
    .map((s) => ({
      id: idFactory(),
      ...(s.title && { title: s.title }),
      steps: s.lines.map((text) => ({
        id: idFactory(),
        text,
        glossarySuppress: [],
        ingredientRefs: [],
      })),
    }));
  if (stepSections.length === 0)
    stepSections = [{ id: idFactory(), steps: [] }];

  const tags = [
    ...new Map(
      (raw.tags ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => [t.toLowerCase(), t]),
    ).values(),
  ].slice(0, 12);
  const positive = (n: number | undefined) =>
    n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;

  const draft: RecipeDraft = {
    title: raw.title?.trim() || 'Untitled recipe',
    ...(raw.description?.trim() && { description: raw.description.trim() }),
    ...(positive(raw.servings) !== undefined && {
      servings: positive(raw.servings),
    }),
    ...(raw.yieldText?.trim() && { yieldText: raw.yieldText.trim() }),
    ...(positive(raw.prepMinutes) !== undefined && {
      prepMinutes: Math.round(raw.prepMinutes ?? 0),
    }),
    ...(positive(raw.cookMinutes) !== undefined && {
      cookMinutes: Math.round(raw.cookMinutes ?? 0),
    }),
    ...(positive(raw.totalMinutes) !== undefined && {
      totalMinutes: Math.round(raw.totalMinutes ?? 0),
    }),
    sourceType: raw.sourceType,
    ...(isUrl(raw.sourceUrl) && { sourceUrl: raw.sourceUrl }),
    ...(raw.sourceAttribution?.trim() && {
      sourceAttribution: raw.sourceAttribution.trim(),
    }),
    ...(isUrl(raw.heroImageUrl) && { heroImageUrl: raw.heroImageUrl }),
    unitSystem: detectUnitSystem(
      ingredientSections.flatMap((s) => s.ingredients),
    ),
    ingredientSections,
    stepSections,
    tags,
  };
  return autoLinkDraft(draft);
}
