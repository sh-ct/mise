import { detectDurations, formatDuration } from './durations';

const find = (text: string) =>
  detectDurations(text).map(({ text: t, minSeconds, maxSeconds }) => [
    t,
    minSeconds,
    maxSeconds,
  ]);

describe('detectDurations', () => {
  it.each([
    ['Bake for 25 minutes until golden.', [['25 minutes', 1500, 1500]]],
    ['Simmer for 10-12 mins.', [['10-12 mins', 600, 720]]],
    ['Simmer for 10 to 12 minutes.', [['10 to 12 minutes', 600, 720]]],
    [
      'Cook for 10 minutes to 12 minutes.',
      [['10 minutes to 12 minutes', 600, 720]],
    ],
    ['Roast for 1 hour 15 minutes.', [['1 hour 15 minutes', 4500, 4500]]],
    ['Roast for 1 hr and 15 mins.', [['1 hr and 15 mins', 4500, 4500]]],
    ['Braise for 1½ hours.', [['1½ hours', 5400, 5400]]],
    ['Braise for 1 1/2 hours.', [['1 1/2 hours', 5400, 5400]]],
    ['Rest for half an hour.', [['half an hour', 1800, 1800]]],
    ['Chill for an hour and a half.', [['an hour and a half', 5400, 5400]]],
    ['Stir for a minute.', [['a minute', 60, 60]]],
    ['Blitz for 30 seconds.', [['30 seconds', 30, 30]]],
    ['Give it a 20-minute rest.', [['20-minute', 1200, 1200]]],
    ['Prove 1h30 somewhere warm.', [['1h30', 5400, 5400]]],
    [
      'Microwave 2m then 30s more.',
      [
        ['2m', 120, 120],
        ['30s', 30, 30],
      ],
    ],
    [
      'Fry for 3-4 minutes, then flip and cook for another 2 minutes.',
      [
        ['3-4 minutes', 180, 240],
        ['2 minutes', 120, 120],
      ],
    ],
    ['Leave for a few minutes.', [['a few minutes', 180, 180]]],
  ])('%s', (text, expected) => {
    expect(find(text)).toEqual(expected);
  });

  it.each([
    ['Roast for 1 hr 15 until tender.', [['1 hr 15', 4500, 4500]]],
    ['Prove for 1h 30.', [['1h 30', 5400, 5400]]],
    ['Simmer 1 to 1½ hours.', [['1 to 1½ hours', 3600, 5400]]],
    ['Pulse for 5-10 secs.', [['5-10 secs', 5, 10]]],
    [
      'Marinate 2 hours, 10 minutes before cooking take it out.',
      [
        ['2 hours', 7200, 7200],
        ['10 minutes', 600, 600],
      ],
    ],
    ['Bake 1 hour at 180C.', [['1 hour', 3600, 3600]]],
    ['Cook 1 hour 2 cups at a time.', [['1 hour', 3600, 3600]]],
  ])('%s', (text, expected) => {
    expect(find(text)).toEqual(expected);
  });

  it.each([
    'Preheat the oven to 180C.',
    'Add 2 tbsp oil.',
    'Cut into 5 m strips.',
    'Cut into 2 cm pieces.',
    'Whisk the whites in a second bowl.',
    'Repeat a second time.',
    'Serves 4.',
    'Add a mixture of herbs.',
    'Leave overnight.',
    'Cook until golden.',
  ])('finds nothing in: %s', (text) => {
    expect(detectDurations(text)).toEqual([]);
  });

  it('reports positions that slice back to the matched text', () => {
    const text = 'Bake for 25 minutes.';
    const [m] = detectDurations(text);
    expect(m && text.slice(m.start, m.end)).toBe('25 minutes');
  });
});

describe('formatDuration', () => {
  it('formats compact durations', () => {
    expect(formatDuration(4500)).toBe('1 h 15 min');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(0)).toBe('0 s');
  });
});
