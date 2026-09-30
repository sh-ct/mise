import { isAppearance, isNightTime, resolveMode } from './appearance';

const at = (hour: number, minute = 0) => new Date(2026, 8, 30, hour, minute);

describe('isNightTime', () => {
  it('is dark from 19:00 to 06:59', () => {
    expect(isNightTime(at(18, 59))).toBe(false);
    expect(isNightTime(at(19, 0))).toBe(true);
    expect(isNightTime(at(0, 30))).toBe(true);
    expect(isNightTime(at(6, 59))).toBe(true);
    expect(isNightTime(at(7, 0))).toBe(false);
  });
});

describe('resolveMode', () => {
  it('honours fixed choices regardless of time or device', () => {
    expect(resolveMode('light', at(23), true)).toBe('light');
    expect(resolveMode('dark', at(12), false)).toBe('dark');
  });

  it('follows the clock for time-based appearance', () => {
    expect(resolveMode('time', at(12), true)).toBe('light');
    expect(resolveMode('time', at(21), false)).toBe('dark');
  });

  it('follows the device for system appearance', () => {
    expect(resolveMode('system', at(12), true)).toBe('dark');
    expect(resolveMode('system', at(23), false)).toBe('light');
  });
});

describe('isAppearance', () => {
  it('accepts only known values', () => {
    expect(isAppearance('time')).toBe(true);
    expect(isAppearance('sepia')).toBe(false);
    expect(isAppearance(undefined)).toBe(false);
  });
});
