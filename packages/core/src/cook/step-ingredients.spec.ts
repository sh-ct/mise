import type { Ingredient } from '../schema/recipe';
import { stepIngredientLines } from './step-ingredients';

const ing = (id: string, partial: Partial<Ingredient>): Ingredient => ({
  id,
  item: 'x',
  optional: false,
  rawText: '',
  ...partial,
});

describe('stepIngredientLines', () => {
  const ingredients = [
    ing('a', { qtyMin: 100, unit: 'g', item: 'butter' }),
    ing('b', { qtyMin: 2, item: 'eggs' }),
  ];

  it('formats the referenced ingredients with the step fraction and serving scale', () => {
    const step = {
      ingredientRefs: [
        { ingredientId: 'b', amountFraction: 1 },
        { ingredientId: 'a', amountFraction: 0.5 },
      ],
    };
    expect(
      stepIngredientLines(step, ingredients, { factor: 2 }).map((l) => [
        l.ingredientId,
        l.text,
      ]),
    ).toEqual([
      ['b', '4 eggs'],
      ['a', '100g butter'],
    ]);
  });

  it('skips references to missing ingredients', () => {
    expect(
      stepIngredientLines(
        { ingredientRefs: [{ ingredientId: 'gone', amountFraction: 1 }] },
        ingredients,
      ),
    ).toEqual([]);
  });
});
