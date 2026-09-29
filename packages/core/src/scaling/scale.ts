import type { Ingredient } from '../schema/recipe';

/** Factor to go from the recipe's servings to the desired servings. 1 when either is unknown. */
export function scaleFactor(
  recipeServings: number | undefined,
  targetServings: number | undefined,
): number {
  if (
    !recipeServings ||
    !targetServings ||
    recipeServings <= 0 ||
    targetServings <= 0
  )
    return 1;
  return targetServings / recipeServings;
}

/** Scale an ingredient's quantity. Ingredients without a quantity ("salt, to taste") are unchanged. */
export function scaleIngredient<
  T extends Pick<Ingredient, 'qtyMin' | 'qtyMax'>,
>(ingredient: T, factor: number): T {
  if (factor === 1 || ingredient.qtyMin === undefined) return ingredient;
  return {
    ...ingredient,
    qtyMin: ingredient.qtyMin * factor,
    ...(ingredient.qtyMax !== undefined && {
      qtyMax: ingredient.qtyMax * factor,
    }),
  };
}
