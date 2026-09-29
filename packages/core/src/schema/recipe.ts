import { z } from 'zod';

/**
 * A recipe as edited in the app and sent to `save_recipe`. Imports (URL, text, scan, AI) all produce this
 * shape and the user reviews it in the editor before saving. IDs are client-generated UUIDs so steps can
 * reference ingredients before anything is persisted.
 */

export const SourceTypeSchema = z.enum(['manual', 'url', 'text', 'scan', 'ai']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const RecipeUnitSystemSchema = z.enum(['metric', 'us', 'mixed']);
export type RecipeUnitSystem = z.infer<typeof RecipeUnitSystemSchema>;

const optionalText = z.string().trim().min(1).optional();
const minutes = z.number().int().nonnegative().optional();

export const IngredientSchema = z
  .object({
    id: z.uuid(),
    qtyMin: z.number().positive().optional(),
    qtyMax: z.number().positive().optional(),
    /** Canonical unit code from `units` (e.g. `g`, `cup`, `clove`). */
    unit: z.string().min(1).optional(),
    item: z.string().trim().min(1),
    /** Preparation, e.g. "finely diced", "to taste". */
    prepNote: optionalText,
    /** Anything else worth keeping, e.g. an alternative measure "(250 g)" or can size "14 oz". */
    note: optionalText,
    optional: z.boolean().default(false),
    /** The original line. Never lost, so a bad parse can always be fixed or re-parsed. */
    rawText: z.string(),
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
  text: z.string().trim().min(1),
  imagePath: optionalText,
  /** Glossary slugs NOT to underline in this step (false positives). */
  glossarySuppress: z.array(z.string()).default([]),
  ingredientRefs: z.array(StepIngredientRefSchema).default([]),
});
export type Step = z.infer<typeof StepSchema>;

export const IngredientSectionSchema = z.object({
  id: z.uuid(),
  title: optionalText,
  ingredients: z.array(IngredientSchema),
});
export type IngredientSection = z.infer<typeof IngredientSectionSchema>;

export const StepSectionSchema = z.object({
  id: z.uuid(),
  title: optionalText,
  steps: z.array(StepSchema),
});
export type StepSection = z.infer<typeof StepSectionSchema>;

export const RecipeDraftSchema = z
  .object({
    /** Present when editing an existing recipe. */
    id: z.uuid().optional(),
    title: z.string().trim().min(1),
    description: optionalText,
    servings: z.number().positive().optional(),
    /** Free-form yield, e.g. "1 loaf", "24 cookies". */
    yieldText: optionalText,
    prepMinutes: minutes,
    cookMinutes: minutes,
    totalMinutes: minutes,
    sourceType: SourceTypeSchema,
    sourceUrl: z.url().optional(),
    sourceAttribution: optionalText,
    unitSystem: RecipeUnitSystemSchema.default('mixed'),
    /** Storage key of the uploaded hero image (base key; size variants derived). */
    heroImagePath: optionalText,
    /** Remote image found during import, to be fetched and uploaded on save. */
    heroImageUrl: z.url().optional(),
    ingredientSections: z.array(IngredientSectionSchema).min(1),
    stepSections: z.array(StepSectionSchema).min(1),
    /** Suggested tag names (e.g. from JSON-LD keywords / cuisine / category). */
    tags: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((draft, ctx) => {
    const ids = new Set(
      draft.ingredientSections.flatMap((s) => s.ingredients.map((i) => i.id)),
    );
    draft.stepSections.forEach((section, si) =>
      section.steps.forEach((step, ti) =>
        step.ingredientRefs.forEach((ref, ri) => {
          if (!ids.has(ref.ingredientId)) {
            ctx.addIssue({
              code: 'custom',
              message:
                'Step references an ingredient that is not in this recipe',
              path: [
                'stepSections',
                si,
                'steps',
                ti,
                'ingredientRefs',
                ri,
                'ingredientId',
              ],
            });
          }
        }),
      ),
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
