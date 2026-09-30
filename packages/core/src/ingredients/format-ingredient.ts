import { displayedValue, formatRange } from '../quantity/quantity.ts';
import { scaleIngredient } from '../scaling/scale.ts';
import type { Ingredient } from '../schema/recipe.ts';
import { toSystem } from '../units/convert.ts';
import { getUnit, unitLabel, type MeasurementSystem } from '../units/units.ts';

export interface IngredientDisplayOptions {
  /** Serving scale factor (see `scaleFactor`). */
  factor?: number;
  /** Share used in a particular step (step_ingredient.amount_fraction). */
  amountFraction?: number;
  /** Convert to this system; `original` keeps the recipe's own units. */
  system?: MeasurementSystem | 'original';
  unitStyle?: 'abbr' | 'long';
}

export interface IngredientDisplay {
  /** e.g. "1½", "250", "2–3"; empty when there's no quantity. */
  quantity: string;
  /** e.g. "cups", "g", "cloves"; empty when there's no unit. */
  unit: string;
  item: string;
  prepNote?: string;
  note?: string;
  optional: boolean;
  /** Quantity, unit, item and prep note: "1½ cups plain flour, sifted". */
  text: string;
}

export function formatIngredient(
  ingredient: Ingredient,
  options: IngredientDisplayOptions = {},
): IngredientDisplay {
  const factor = (options.factor ?? 1) * (options.amountFraction ?? 1);
  let { qtyMin, qtyMax, unit } = scaleIngredient(ingredient, factor);

  if (
    options.system &&
    options.system !== 'original' &&
    unit &&
    qtyMin !== undefined
  ) {
    const min = toSystem(qtyMin, unit, options.system, {
      item: ingredient.item,
    });
    if (min) {
      const max =
        qtyMax !== undefined
          ? toSystem(qtyMax, unit, options.system, { item: ingredient.item })
          : undefined;
      qtyMin = min.value;
      // Keep the range only if both ends landed in the same unit.
      qtyMax = max && max.unit === min.unit ? max.value : undefined;
      unit = min.unit;
    }
  }

  const def = getUnit(unit);
  const style = def?.system === 'metric' ? 'decimal' : 'fraction';
  const quantity =
    qtyMin === undefined ? '' : formatRange(qtyMin, qtyMax, style);
  const shown =
    qtyMin === undefined ? undefined : displayedValue(qtyMax ?? qtyMin, style);
  const unitText = unit
    ? unitLabel(unit, shown, options.unitStyle ?? 'abbr')
    : '';

  // Metric abbreviations sit tight against the number ("250g"); everything else gets a space.
  const tight = def?.system === 'metric' && unitText === def.abbr;
  const qtyUnit =
    quantity && unitText
      ? `${quantity}${tight ? '' : ' '}${unitText}`
      : quantity || unitText;
  const text =
    [qtyUnit, ingredient.item].filter(Boolean).join(' ') +
    (ingredient.prepNote ? `, ${ingredient.prepNote}` : '');

  return {
    quantity,
    unit: unitText,
    item: ingredient.item,
    ...(ingredient.prepNote && { prepNote: ingredient.prepNote }),
    ...(ingredient.note && { note: ingredient.note }),
    optional: ingredient.optional,
    text,
  };
}
