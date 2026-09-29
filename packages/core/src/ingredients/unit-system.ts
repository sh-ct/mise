import type { Ingredient, RecipeUnitSystem } from '../schema/recipe';
import { getUnit } from '../units/units';

/**
 * Guess a recipe's measurement system from its ingredients. Teaspoons/tablespoons are ignored because
 * metric recipes use them too.
 */
export function detectUnitSystem(
  ingredients: Pick<Ingredient, 'unit'>[],
): RecipeUnitSystem {
  let metric = 0;
  let us = 0;
  for (const { unit } of ingredients) {
    if (unit === 'tsp' || unit === 'tbsp') continue;
    const system = getUnit(unit)?.system;
    if (system === 'metric') metric++;
    else if (system === 'us') us++;
  }
  if (metric === 0 && us === 0) return 'mixed';
  if (metric > 0 && us > 0) {
    // A stray "1 cup" in an otherwise metric recipe still reads as metric.
    if (metric >= us * 3) return 'metric';
    if (us >= metric * 3) return 'us';
    return 'mixed';
  }
  return metric > 0 ? 'metric' : 'us';
}
