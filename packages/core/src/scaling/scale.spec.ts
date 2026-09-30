import { scaleFactor, scaleIngredient } from './scale.ts';

describe('scaling', () => {
  it('computes the factor, defaulting to 1 when servings are unknown', () => {
    expect(scaleFactor(4, 6)).toBe(1.5);
    expect(scaleFactor(undefined, 6)).toBe(1);
    expect(scaleFactor(4, 0)).toBe(1);
  });

  it('scales both ends of a range and leaves unquantified ingredients alone', () => {
    expect(scaleIngredient({ qtyMin: 2, qtyMax: 3 }, 2)).toEqual({
      qtyMin: 4,
      qtyMax: 6,
    });
    expect(scaleIngredient({}, 2)).toEqual({});
  });
});
