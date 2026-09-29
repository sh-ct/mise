import {
  looksLikeIngredient,
  parseIngredientLine,
  toIngredient,
} from './parse-ingredient';

describe('parseIngredientLine', () => {
  it.each([
    ['2 cups plain flour', { qtyMin: 2, unit: 'cup', item: 'plain flour' }],
    [
      '250g butter, softened',
      { qtyMin: 250, unit: 'g', item: 'butter', prepNote: 'softened' },
    ],
    [
      '1 1/2 tsp baking powder',
      { qtyMin: 1.5, unit: 'tsp', item: 'baking powder' },
    ],
    ['½ cup milk', { qtyMin: 0.5, unit: 'cup', item: 'milk' }],
    [
      '2-3 cloves garlic, crushed',
      {
        qtyMin: 2,
        qtyMax: 3,
        unit: 'clove',
        item: 'garlic',
        prepNote: 'crushed',
      },
    ],
    ['3 large eggs', { qtyMin: 3, item: 'large eggs' }],
    [
      '1 onion, finely diced',
      { qtyMin: 1, item: 'onion', prepNote: 'finely diced' },
    ],
    [
      '2 cups (250 g) all-purpose flour, sifted',
      {
        qtyMin: 2,
        unit: 'cup',
        item: 'all-purpose flour',
        prepNote: 'sifted',
        note: '250 g',
      },
    ],
    [
      '1 (14 oz) can chopped tomatoes',
      { qtyMin: 1, unit: 'can', item: 'chopped tomatoes', note: '14 oz' },
    ],
    ['a pinch of salt', { qtyMin: 1, unit: 'pinch', item: 'salt' }],
    [
      'pinch of chilli flakes',
      { qtyMin: 1, unit: 'pinch', item: 'chilli flakes' },
    ],
    [
      'Salt and pepper, to taste',
      { item: 'Salt and pepper', prepNote: 'to taste' },
    ],
    [
      'Fresh coriander, to serve',
      { item: 'Fresh coriander', prepNote: 'to serve' },
    ],
    ['Olive oil for frying', { item: 'Olive oil', prepNote: 'for frying' }],
    [
      '1 tbsp sugar (optional)',
      { qtyMin: 1, unit: 'tbsp', item: 'sugar', optional: true },
    ],
    [
      'Optional: 50g walnuts',
      { qtyMin: 50, unit: 'g', item: 'walnuts', optional: true },
    ],
    ['- 400ml coconut milk', { qtyMin: 400, unit: 'ml', item: 'coconut milk' }],
    ['• 2 tbsp olive oil', { qtyMin: 2, unit: 'tbsp', item: 'olive oil' }],
    [
      '200g / 7oz dark chocolate, chopped',
      {
        qtyMin: 200,
        unit: 'g',
        item: 'dark chocolate',
        prepNote: 'chopped',
        note: '7oz',
      },
    ],
    [
      '2cm piece ginger, grated',
      { qtyMin: 2, unit: 'cm', item: 'piece ginger', prepNote: 'grated' },
    ],
    ['1 cup of sugar', { qtyMin: 1, unit: 'cup', item: 'sugar' }],
    ['1-1/2 cups flour', { qtyMin: 1.5, unit: 'cup', item: 'flour' }],
    [
      '2 x 400g tins chopped tomatoes',
      { qtyMin: 2, unit: 'tin', item: 'chopped tomatoes', note: '400g' },
    ],
    [
      '1 x 400g can chickpeas, drained',
      {
        qtyMin: 1,
        unit: 'can',
        item: 'chickpeas',
        prepNote: 'drained',
        note: '400g',
      },
    ],
    [
      '100ml/3½fl oz milk',
      { qtyMin: 100, unit: 'ml', item: 'milk', note: '3½fl oz' },
    ],
    ['1 lb 2 oz beef mince', { qtyMin: 18, unit: 'oz', item: 'beef mince' }],
    ['1. 2 cups rice', { qtyMin: 2, unit: 'cup', item: 'rice' }],
    ['Two tablespoons honey', { qtyMin: 2, unit: 'tbsp', item: 'honey' }],
    [
      'flour (plain), for dusting',
      { item: 'flour', prepNote: 'for dusting', note: 'plain' },
    ],
  ])('%s', (line, expected) => {
    const parsed = parseIngredientLine(line);
    expect(parsed).toMatchObject({
      optional: false,
      ...expected,
      rawText: line,
    });
    // No stray fields
    for (const key of [
      'qtyMin',
      'qtyMax',
      'unit',
      'prepNote',
      'note',
    ] as const) {
      if (!(key in expected)) expect(parsed[key]).toBeUndefined();
    }
  });

  it('keeps the raw line when nothing but a quantity is present', () => {
    expect(parseIngredientLine('2 cups')).toEqual({
      item: '2 cups',
      optional: false,
      rawText: '2 cups',
    });
  });

  it('does not read a leading "a" as a quantity without a unit', () => {
    expect(parseIngredientLine('a few basil leaves')).toMatchObject({
      item: 'a few basil leaves',
    });
    expect(parseIngredientLine('a few basil leaves').qtyMin).toBeUndefined();
  });

  it('toIngredient adds an id', () => {
    expect(toIngredient('1 egg', () => 'id-1')).toMatchObject({
      id: 'id-1',
      qtyMin: 1,
      item: 'egg',
    });
  });
});

describe('looksLikeIngredient', () => {
  it.each([
    '2 cups flour',
    '- 1 egg',
    'Salt and pepper',
    'Fresh coriander, to serve',
  ])('yes: %s', (line) => {
    expect(looksLikeIngredient(line)).toBe(true);
  });

  it.each([
    'Preheat the oven to 180C and grease a tin.',
    'Ingredients:',
    'Mix everything together until smooth and glossy, then set aside',
  ])('no: %s', (line) => {
    expect(looksLikeIngredient(line)).toBe(false);
  });
});
