import { convert, toSystem } from './convert';
import { densityFor } from './density';
import { matchUnitPrefix, parseUnit, unitLabel } from './units';

describe('matchUnitPrefix', () => {
  it.each([
    ['cups flour', 'cup', 4],
    ['cup of sugar', 'cup', 6],
    ['g butter', 'g', 1],
    ['grams butter', 'g', 5],
    ['tbsp. oil', 'tbsp', 5],
    ['Tbsp oil', 'tbsp', 4],
    ['T oil', 'tbsp', 1],
    ['t salt', 'tsp', 1],
    ['fl oz milk', 'fl_oz', 5],
    ['cloves garlic', 'clove', 6],
    ['kg potatoes', 'kg', 2],
    ['l milk', 'l', 1],
  ])('%s → %s', (text, code, length) => {
    expect(matchUnitPrefix(text)).toMatchObject({ unit: { code }, length });
  });

  it.each(['garlic', 'large eggs', 'lemons', 'tomatoes', 'carrots', 'onion'])(
    'does not match a unit inside %s',
    (text) => {
      expect(matchUnitPrefix(text)).toBeUndefined();
    },
  );
});

describe('parseUnit', () => {
  it('parses a whole unit string', () => {
    expect(parseUnit('Tablespoons')?.code).toBe('tbsp');
    expect(parseUnit('tsp.')?.code).toBe('tsp');
    expect(parseUnit('cups of')?.code).toBe('cup');
  });

  it('rejects strings with trailing words', () => {
    expect(parseUnit('cup flour')).toBeUndefined();
  });
});

describe('unitLabel', () => {
  it('uses abbreviations or singular/plural', () => {
    expect(unitLabel('tbsp', 2)).toBe('tbsp');
    expect(unitLabel('tbsp', 2, 'long')).toBe('tablespoons');
    expect(unitLabel('cup', 1)).toBe('cup');
    expect(unitLabel('cup', 2)).toBe('cups');
    expect(unitLabel('clove', 3)).toBe('cloves');
  });
});

describe('convert', () => {
  it('converts within a dimension', () => {
    expect(convert(1, 'kg', 'g')).toBe(1000);
    expect(convert(16, 'oz', 'lb')).toBeCloseTo(1, 3);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1);
    expect(convert(1, 'cup', 'ml')).toBeCloseTo(236.6, 1);
  });

  it('needs a density across dimensions', () => {
    expect(convert(1, 'cup', 'g')).toBeUndefined();
    expect(convert(1, 'cup', 'g', 0.53)).toBeCloseTo(125.4, 1);
    expect(convert(100, 'g', 'ml', 1)).toBeCloseTo(100);
  });

  it('never converts count units', () => {
    expect(convert(2, 'clove', 'g')).toBeUndefined();
  });
});

describe('toSystem', () => {
  it('picks readable metric units', () => {
    expect(toSystem(2, 'lb', 'metric')).toMatchObject({ unit: 'g' });
    expect(toSystem(4, 'lb', 'metric')).toMatchObject({ unit: 'kg' });
    expect(toSystem(5, 'cup', 'metric')).toMatchObject({ unit: 'l' });
  });

  it('picks readable US units', () => {
    expect(toSystem(15, 'ml', 'us')).toMatchObject({ unit: 'tbsp' });
    expect(toSystem(5, 'ml', 'us')).toMatchObject({ unit: 'tsp' });
    expect(toSystem(250, 'ml', 'us')?.unit).toBe('cup');
    expect(toSystem(60, 'ml', 'us')?.unit).toBe('cup'); // ¼ cup
    expect(toSystem(500, 'g', 'us')?.unit).toBe('lb');
  });

  it('keeps units already in the target system', () => {
    expect(toSystem(2, 'cup', 'us')).toEqual({ value: 2, unit: 'cup' });
  });

  it('weighs solids and keeps liquids in volume for metric', () => {
    const flour = toSystem(1, 'cup', 'metric', { item: 'plain flour' });
    expect(flour?.unit).toBe('g');
    expect(flour?.value).toBeCloseTo(125, 0);
    expect(toSystem(1, 'cup', 'metric', { item: 'whole milk' })?.unit).toBe(
      'ml',
    );
  });

  it('measures by volume for US when a density is known', () => {
    expect(toSystem(125, 'g', 'us', { item: 'flour' })).toMatchObject({
      unit: 'cup',
    });
    expect(toSystem(125, 'g', 'us', { item: 'chopped parsley' })?.unit).toBe(
      'oz',
    );
  });

  it('falls back to the same dimension without a density', () => {
    expect(
      toSystem(1, 'cup', 'metric', { item: 'chopped parsley' })?.unit,
    ).toBe('ml');
  });

  it('keeps spoons in both systems', () => {
    expect(toSystem(1, 'tsp', 'metric', { item: 'salt' })).toEqual({
      value: 1,
      unit: 'tsp',
    });
    expect(toSystem(2, 'tbsp', 'us')).toEqual({ value: 2, unit: 'tbsp' });
  });

  it('ignores count units', () => {
    expect(toSystem(2, 'clove', 'metric')).toBeUndefined();
  });
});

describe('densityFor', () => {
  it('prefers the most specific match', () => {
    expect(densityFor('Brown sugar, packed')).toEqual({
      gPerMl: 0.93,
      liquid: false,
    });
    expect(densityFor('sugar')?.gPerMl).toBe(0.85);
    expect(densityFor('extra virgin olive oil')).toEqual({
      gPerMl: 0.91,
      liquid: true,
    });
  });

  it('matches whole words only', () => {
    expect(densityFor('cornflakes')).toBeUndefined();
  });
});
