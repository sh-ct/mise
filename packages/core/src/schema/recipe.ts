import { z } from 'zod';

/**
 * Size limits shared with the database check constraints (supabase/migrations). Keep them in sync so a
 * draft that validates here never fails on save.
 */
export const LIMITS = {
  title: 200,
  description: 5000,
  yieldText: 100,
  attribution: 200,
  url: 2000,
  path: 500,
  sectionTitle: 100,
  item: 200,
  prepNote: 200,
  note: 200,
  rawText: 500,
  unit: 20,
  stepText: 5000,
  tag: 40,
  tags: 30,
  sections: 20,
  ingredients: 300,
  steps: 200,
  refsPerStep: 50,
  glossarySuppress: 50,
  servings: 1000,
  /** One week: long enough for curing, sourdough and the like. */
  minutes: 10_080,
  quantity: 100_000,
} as const;

export const SourceTypeSchema = z.enum(['manual', 'url', 'text', 'scan', 'ai']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const RecipeUnitSystemSchema = z.enum(['metric', 'us', 'mixed']);
export type RecipeUnitSystem = z.infer<typeof RecipeUnitSystemSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => text(max).optional();
const minutes = z.number().int().nonnegative().max(LIMITS.minutes).optional();
const quantity = z.number().positive().max(LIMITS.quantity).optional();
// z.url() alone accepts javascript:, data: and file: URLs.
const webUrl = z.url({ protocol: /^https?$/ }).max(LIMITS.url);

export const IngredientSchema = z
  .object({
    id: z.uuid(),
    qtyMin: quantity,
    qtyMax: quantity,
    /** Canonical unit code from `units` (e.g. `g`, `cup`, `clove`). */
    unit: z.string().min(1).max(LIMITS.unit).optional(),
    item: text(LIMITS.item),
    /** Preparation, e.g. "finely diced", "to taste". */
    prepNote: optionalText(LIMITS.prepNote),
    /** Anything else worth keeping, e.g. an alternative measure "(250 g)" or can size "14 oz". */
    note: optionalText(LIMITS.note),
    optional: z.boolean().default(false),
    /** The original line. Never lost, so a bad parse can always be fixed or re-parsed. */
    rawText: z.string().max(LIMITS.rawText),
  })
  .refine(
    (i) =>
      i.qtyMax === undefined ||
      (i.qtyMin !== undefined && i.qtyMax >= i.qtyMin),
    {
      message: 'qtyMax requires qtyMin and must be >= qtyMin',
      path: ['qtyMax'],
    },
  );
export type Ingredient = z.infer<typeof IngredientSchema>;

export const StepIngredientRefSchema = z.object({
  ingredientId: z.uuid(),
  /** Share of the ingredient used in this step, e.g. 0.5 for "half the butter". */
  amountFraction: z.number().gt(0).lte(1).default(1),
});
export type StepIngredientRef = z.infer<typeof StepIngredientRefSchema>;

export const StepSchema = z.object({
  id: z.uuid(),
  /** Plain prose. Timers and glossary terms are detected at render time (ADR 0005). */
  text: text(LIMITS.stepText),
  imagePath: optionalText(LIMITS.path),
  /** Glossary slugs NOT to underline in this step (false positives). */
  glossarySuppress: z
    .array(z.string())
    .max(LIMITS.glossarySuppress)
    .default([]),
  ingredientRefs: z
    .array(StepIngredientRefSchema)
    .max(LIMITS.refsPerStep)
    .default([]),
});
export type Step = z.infer<typeof StepSchema>;

export const IngredientSectionSchema = z.object({
  id: z.uuid(),
  title: optionalText(LIMITS.sectionTitle),
  ingredients: z.array(IngredientSchema).max(LIMITS.ingredients),
});
export type IngredientSection = z.infer<typeof IngredientSectionSchema>;

export const StepSectionSchema = z.object({
  id: z.uuid(),
  title: optionalText(LIMITS.sectionTitle),
  steps: z.array(StepSchema).max(LIMITS.steps),
});
export type StepSection = z.infer<typeof StepSectionSchema>;

/**
 * A recipe as edited in the app and sent to `save_recipe`. Imports (URL, text, scan, AI) all produce this
 * shape and the user reviews it in the editor before saving. All ids, including the recipe's, are
 * client-generated UUIDs: steps can reference ingredients before anything is stored, and re-sending the
 * same draft is an idempotent overwrite.
 */
export const RecipeDraftSchema = z
  .object({
    id: z.uuid(),
    title: text(LIMITS.title),
    description: optionalText(LIMITS.description),
    servings: z.number().positive().max(LIMITS.servings).optional(),
    /** Free-form yield, e.g. "1 loaf", "24 cookies". */
    yieldText: optionalText(LIMITS.yieldText),
    prepMinutes: minutes,
    cookMinutes: minutes,
    totalMinutes: minutes,
    sourceType: SourceTypeSchema,
    sourceUrl: webUrl.optional(),
    sourceAttribution: optionalText(LIMITS.attribution),
    unitSystem: RecipeUnitSystemSchema.default('mixed'),
    /** Storage key of the uploaded hero image (base key; size variants derived). */
    heroImagePath: optionalText(LIMITS.path),
    /** Remote image found during import; the client uploads it and sets `heroImagePath`. */
    heroImageUrl: webUrl.optional(),
    ingredientSections: z
      .array(IngredientSectionSchema)
      .min(1)
      .max(LIMITS.sections),
    stepSections: z.array(StepSectionSchema).min(1).max(LIMITS.sections),
    /** Tag names (e.g. suggested from JSON-LD keywords / cuisine / category). */
    tags: z.array(text(LIMITS.tag)).max(LIMITS.tags).default([]),
  })
  .superRefine((draft, ctx) => {
    const ingredients = allIngredients(draft);
    const steps = allSteps(draft);
    if (ingredients.length > LIMITS.ingredients) {
      ctx.addIssue({
        code: 'custom',
        message: `At most ${LIMITS.ingredients} ingredients`,
        path: ['ingredientSections'],
      });
    }
    if (steps.length > LIMITS.steps) {
      ctx.addIssue({
        code: 'custom',
        message: `At most ${LIMITS.steps} steps`,
        path: ['stepSections'],
      });
    }

    const seen = new Set<string>();
    for (const id of [
      ...draft.ingredientSections.map((s) => s.id),
      ...draft.stepSections.map((s) => s.id),
      ...ingredients.map((i) => i.id),
      ...steps.map((s) => s.id),
    ]) {
      if (seen.has(id))
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate id ${id}`,
          path: [],
        });
      seen.add(id);
    }

    const ingredientIds = new Set(ingredients.map((i) => i.id));
    draft.stepSections.forEach((section, si) =>
      section.steps.forEach((step, ti) => {
        const refs = new Set<string>();
        step.ingredientRefs.forEach((ref, ri) => {
          const path = [
            'stepSections',
            si,
            'steps',
            ti,
            'ingredientRefs',
            ri,
            'ingredientId',
          ];
          if (!ingredientIds.has(ref.ingredientId)) {
            ctx.addIssue({
              code: 'custom',
              message:
                'Step references an ingredient that is not in this recipe',
              path,
            });
          } else if (refs.has(ref.ingredientId)) {
            ctx.addIssue({
              code: 'custom',
              message: 'Step references the same ingredient twice',
              path,
            });
          }
          refs.add(ref.ingredientId);
        });
      }),
    );
  });
export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;
export type RecipeDraftInput = z.input<typeof RecipeDraftSchema>;

/** All ingredients across sections, in order. */
export function allIngredients(
  draft: Pick<RecipeDraft, 'ingredientSections'>,
): Ingredient[] {
  return draft.ingredientSections.flatMap((s) => s.ingredients);
}

/** All steps across sections, in order. */
export function allSteps(draft: Pick<RecipeDraft, 'stepSections'>): Step[] {
  return draft.stepSections.flatMap((s) => s.steps);
}
