import {
  formatIngredient,
  type IngredientDisplay,
  type IngredientDisplayOptions,
} from '../ingredients/format-ingredient';
import type { Ingredient, Step } from '../schema/recipe';

export interface StepIngredientLine extends IngredientDisplay {
  ingredientId: string;
}

/**
 * The ingredients a step uses, formatted with the step's share (`amountFraction`), the serving scale
 * and the chosen unit system — what cook mode shows under the current and next step.
 * References to ingredients that no longer exist are skipped.
 */
export function stepIngredientLines(
  step: Pick<Step, 'ingredientRefs'>,
  ingredients: readonly Ingredient[],
  options: Omit<IngredientDisplayOptions, 'amountFraction'> = {},
): StepIngredientLine[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return step.ingredientRefs.flatMap((ref) => {
    const ingredient = byId.get(ref.ingredientId);
    return ingredient
      ? [
          {
            ingredientId: ingredient.id,
            ...formatIngredient(ingredient, {
              ...options,
              amountFraction: ref.amountFraction,
            }),
          },
        ]
      : [];
  });
}
