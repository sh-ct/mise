import type { Ingredient } from '../schema/recipe.ts';
import { formatIngredient } from './format-ingredient.ts';
import { detectUnitSystem } from './unit-system.ts';

const ing = (partial: Partial<Ingredient>): Ingredient => ({
  id: '00000000-0000-4000-8000-000000000000',
  item: 'flour',
  optional: false,
  rawText: '',
  ...partial,
});

describe('formatIngredient', () => {
  it('formats US units with fractions', () => {
    expect(
      formatIngredient(
        ing({
          qtyMin: 1.5,
          unit: 'cup',
          item: 'plain flour',
          prepNote: 'sifted',
        }),
      ).text,
    ).toBe('1½ cups plain flour, sifted');
  });

  it('formats metric units tight with decimals', () => {
    expect(
      formatIngredient(ing({ qtyMin: 250, unit: 'g', item: 'butter' })).text,
    ).toBe('250g butter');
  });

  it('formats count units and no-unit quantities', () => {
    expect(
      formatIngredient(
        ing({ qtyMin: 2, qtyMax: 3, unit: 'clove', item: 'garlic' }),
      ).text,
    ).toBe('2–3 cloves garlic');
    expect(formatIngredient(ing({ qtyMin: 3, item: 'eggs' })).text).toBe(
      '3 eggs',
    );
  });

  it('formats ingredients without quantity', () => {
    expect(
      formatIngredient(ing({ item: 'Salt', prepNote: 'to taste' })).text,
    ).toBe('Salt, to taste');
  });

  it('scales by servings factor and step fraction', () => {
    expect(
      formatIngredient(ing({ qtyMin: 1, unit: 'cup', item: 'milk' }), {
        factor: 1.5,
      }).quantity,
    ).toBe('1½');
    expect(
      formatIngredient(ing({ qtyMin: 100, unit: 'g', item: 'butter' }), {
        factor: 2,
        amountFraction: 0.5,
      }).quantity,
    ).toBe('100');
  });

  it('converts to another system on request', () => {
    const r = formatIngredient(ing({ qtyMin: 2, unit: 'cup', item: 'milk' }), {
      system: 'metric',
    });
    expect(r.unit).toBe('ml');
    expect(r.quantity).toBe('475');
  });

  it('keeps spoons and weighs dry goods when converting to metric', () => {
    expect(
      formatIngredient(ing({ qtyMin: 1, unit: 'tsp', item: 'salt' }), {
        system: 'metric',
      }).text,
    ).toBe('1 tsp salt');
    expect(
      formatIngredient(ing({ qtyMin: 2, unit: 'cup', item: 'plain flour' }), {
        system: 'metric',
      }).text,
    ).toBe('250g plain flour');
  });

  it('chooses singular or plural from the displayed quantity', () => {
    const milk = ing({ qtyMin: 1, unit: 'cup', item: 'milk' });
    expect(
      formatIngredient(milk, { factor: 1.04, unitStyle: 'long' }).text,
    ).toBe('1 cup milk');
    const garlic = ing({ qtyMin: 3, unit: 'clove', item: 'garlic' });
    expect(formatIngredient(garlic, { factor: 0.35 }).text).toBe(
      '1 clove garlic',
    );
  });

  it('leaves count units alone when converting', () => {
    expect(
      formatIngredient(ing({ qtyMin: 2, unit: 'clove', item: 'garlic' }), {
        system: 'metric',
      }).text,
    ).toBe('2 cloves garlic');
  });
});

describe('detectUnitSystem', () => {
  it('detects metric, US and mixed', () => {
    expect(
      detectUnitSystem([{ unit: 'g' }, { unit: 'ml' }, { unit: 'tbsp' }]),
    ).toBe('metric');
    expect(detectUnitSystem([{ unit: 'cup' }, { unit: 'oz' }])).toBe('us');
    expect(detectUnitSystem([{ unit: 'cup' }, { unit: 'g' }])).toBe('mixed');
    expect(
      detectUnitSystem([
        { unit: 'g' },
        { unit: 'g' },
        { unit: 'g' },
        { unit: 'cup' },
      ]),
    ).toBe('metric');
    expect(detectUnitSystem([{}, { unit: 'clove' }])).toBe('mixed');
  });
});
