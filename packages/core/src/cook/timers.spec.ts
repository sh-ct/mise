import {
  dismissTimer,
  expiryMessage,
  extendOptions,
  extendTimer,
  formatClock,
  remainingMs,
  startTimer,
  timerState,
} from './timers';

const T0 = 1_000_000;

describe('cook timers', () => {
  const simple = startTimer(
    { text: '25 minutes', minSeconds: 1500, maxSeconds: 1500 },
    { id: 't1', now: T0, stepId: 's1' },
  );
  const range = startTimer(
    { text: '10-12 mins', minSeconds: 600, maxSeconds: 720 },
    { id: 't2', now: T0 },
  );

  it('starts at the lower bound of a range', () => {
    expect(range.endsAt).toBe(T0 + 600_000);
    expect(range.rangeExtraSeconds).toBe(120);
    expect(simple).toMatchObject({
      label: '25 minutes',
      stepId: 's1',
      rangeExtraSeconds: 0,
    });
  });

  it('computes remaining time and state from absolute timestamps', () => {
    expect(remainingMs(simple, T0 + 60_000)).toBe(1_440_000);
    expect(timerState(simple, T0 + 60_000)).toBe('running');
    expect(timerState(simple, T0 + 1_500_000)).toBe('expired');
    expect(remainingMs(simple, T0 + 1_510_000)).toBe(-10_000);
  });

  it('extends a running timer from its end time', () => {
    expect(extendTimer(simple, 60, T0 + 1000).endsAt).toBe(T0 + 1_560_000);
  });

  it('extends an expired timer from now, clearing dismissal', () => {
    const later = T0 + 2_000_000;
    const extended = extendTimer(dismissTimer(simple, later), 120, later);
    expect(extended.endsAt).toBe(later + 120_000);
    expect(extended.dismissedAt).toBeUndefined();
    expect(timerState(extended, later)).toBe('running');
  });

  it('prompts a check for ranges', () => {
    expect(expiryMessage(range)).toBe(
      '10-12 mins: check now — may need up to 2 min more',
    );
    expect(expiryMessage(simple)).toBe("25 minutes: time's up");
  });

  it('offers the remaining range as an extend option', () => {
    expect(extendOptions(simple)).toEqual([60, 120, 300]);
    expect(extendOptions({ ...range, rangeExtraSeconds: 180 })).toEqual([
      60, 120, 180, 300,
    ]);
  });

  it('uses up the range when extended, so the next expiry is final', () => {
    const extended = extendTimer(range, 120, T0 + 600_000);
    expect(extended.rangeExtraSeconds).toBe(0);
    expect(expiryMessage(extended)).toBe("10-12 mins: time's up");
    expect(extendTimer(range, 60, T0).rangeExtraSeconds).toBe(60);
  });

  it('formats countdown clocks, including overrun', () => {
    expect(formatClock(299)).toBe('4:59');
    expect(formatClock(3900)).toBe('1:05:00');
    expect(formatClock(-7)).toBe('+0:07');
  });
});
