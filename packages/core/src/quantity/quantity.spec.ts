import {
  displayedValue,
  formatQuantity,
  formatRange,
  parseLeadingQuantity,
  parseNumber,
} from './quantity.ts';

describe('parseNumber', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['1/2', 0.5],
    ['1 ⁄ 2', 0.5],
    ['1 1/2', 1.5],
    ['½', 0.5],
    ['1½', 1.5],
    ['1 ½', 1.5],
    ['2⅔', 2 + 2 / 3],
    ['1-1/2', 1.5],
  ])('%s → %d', (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected);
  });

  it.each(['', 'abc', '1/0', '1/'])('rejects %j', (input) => {
    expect(parseNumber(input)).toBeUndefined();
  });
});

describe('parseLeadingQuantity', () => {
  it('parses a plain number and reports consumed length', () => {
    expect(parseLeadingQuantity('2 cups flour')).toEqual({ min: 2, length: 2 });
  });

  it('parses a number stuck to a unit', () => {
    expect(parseLeadingQuantity('250g butter')).toEqual({
      min: 250,
      length: 3,
    });
  });

  it.each([
    ['2-3 cloves', 2, 3],
    ['2 – 3 cloves', 2, 3],
    ['2 to 3 cloves', 2, 3],
    ['1 or 2 eggs', 1, 2],
    ['1½-2 cups', 1.5, 2],
  ])('parses range %s', (input, min, max) => {
    expect(parseLeadingQuantity(input)).toMatchObject({ min, max });
  });

  it('drops a degenerate range', () => {
    expect(parseLeadingQuantity('3-2 eggs')).toEqual({ min: 3, length: 4 });
  });

  it('only accepts word quantities when asked', () => {
    expect(parseLeadingQuantity('a pinch of salt')).toBeUndefined();
    expect(
      parseLeadingQuantity('a pinch of salt', { allowWords: true }),
    ).toEqual({ min: 1, length: 2 });
    expect(parseLeadingQuantity('Two eggs', { allowWords: true })).toEqual({
      min: 2,
      length: 4,
    });
  });

  it('does not treat words starting with "a" as quantities', () => {
    expect(
      parseLeadingQuantity('apples', { allowWords: true }),
    ).toBeUndefined();
  });

  it('returns undefined for non-quantities', () => {
    expect(parseLeadingQuantity('Salt')).toBeUndefined();
    expect(parseLeadingQuantity('0 eggs')).toBeUndefined();
  });
});

describe('parseLeadingQuantity (US mixed numbers)', () => {
  it('reads "1-1/2" as one and a half, not a range', () => {
    expect(parseLeadingQuantity('1-1/2 cups')).toEqual({ min: 1.5, length: 6 });
    expect(parseLeadingQuantity('1-2 cups')).toMatchObject({ min: 1, max: 2 });
  });
});

describe('displayedValue', () => {
  it('returns the value as it will be shown', () => {
    expect(displayedValue(1.04)).toBe(1);
    expect(displayedValue(0.35)).toBeCloseTo(1 / 3);
    expect(displayedValue(247, 'decimal')).toBe(245);
  });
});

describe('formatQuantity', () => {
  it.each([
    [0.5, '½'],
    [1.5, '1½'],
    [0.333, '⅓'],
    [0.25, '¼'],
    [2, '2'],
    [2.97, '3'],
    [0.125, '⅛'],
    [1.6667, '1⅔'],
    [0.02, '0.02'],
    [0.004, '0.004'],
  ])('fraction %d → %s', (value, expected) => {
    expect(formatQuantity(value)).toBe(expected);
  });

  it.each([
    [250, '250'],
    [247, '245'],
    [12.4, '12'],
    [1.25, '1.3'],
    [0.333, '0.33'],
  ])('decimal %d → %s', (value, expected) => {
    expect(formatQuantity(value, 'decimal')).toBe(expected);
  });

  it('formats ranges and collapses equal ends', () => {
    expect(formatRange(2, 3)).toBe('2–3');
    expect(formatRange(2, 2.01)).toBe('2');
  });
});
