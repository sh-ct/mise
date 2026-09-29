import { formatDuration, type DurationMatch } from '../steps/durations';

/**
 * Cook-mode timers. Times are absolute epoch milliseconds (`endsAt`), never "remaining" counters, so a
 * timer stays correct when the tab is suspended, the screen locks or the app reloads (ADR 0005).
 * All functions are pure: pass `now` in.
 */
export interface CookTimer {
  id: string;
  label: string;
  stepId?: string;
  startedAt: number;
  endsAt: number;
  /** Seconds the recipe says it might take beyond the lower bound (ranges like "10–12 min"). */
  rangeExtraSeconds: number;
  /** Set once the timer has been acknowledged after firing. */
  dismissedAt?: number;
}

export type TimerState = 'running' | 'expired' | 'dismissed';

export interface StartTimerOptions {
  id: string;
  now: number;
  stepId?: string;
  label?: string;
}

/** Start a timer from a detected duration. Ranges start at the lower bound with a "check" prompt. */
export function startTimer(
  duration: Pick<DurationMatch, 'minSeconds' | 'maxSeconds' | 'text'>,
  options: StartTimerOptions,
): CookTimer {
  return {
    id: options.id,
    label: options.label ?? duration.text,
    ...(options.stepId !== undefined && { stepId: options.stepId }),
    startedAt: options.now,
    endsAt: options.now + duration.minSeconds * 1000,
    rangeExtraSeconds: Math.max(0, duration.maxSeconds - duration.minSeconds),
  };
}

/** Milliseconds left; negative once expired (how long ago it went off). */
export function remainingMs(timer: CookTimer, now: number): number {
  return timer.endsAt - now;
}

export function timerState(timer: CookTimer, now: number): TimerState {
  if (timer.dismissedAt !== undefined) return 'dismissed';
  return now >= timer.endsAt ? 'expired' : 'running';
}

/**
 * Add time. Works while running (pushes the end back) and after expiry (restarts from now), so
 * "+2 min" still does what you expect when the cake isn't done yet.
 */
export function extendTimer(
  timer: CookTimer,
  seconds: number,
  now: number,
): CookTimer {
  const { dismissedAt: _dismissed, ...rest } = timer;
  const base = now >= timer.endsAt ? now : timer.endsAt;
  return { ...rest, endsAt: base + seconds * 1000 };
}

export function dismissTimer(timer: CookTimer, now: number): CookTimer {
  return { ...timer, dismissedAt: now };
}

/** Message to show when a timer fires. For ranges, prompts a check and suggests the extra time. */
export function expiryMessage(timer: CookTimer): string {
  if (timer.rangeExtraSeconds > 0) {
    return `${timer.label}: check now — may need up to ${formatDuration(timer.rangeExtraSeconds)} more`;
  }
  return `${timer.label}: time's up`;
}

/** Quick-extend options offered on a timer (seconds). Includes the remaining range if there is one. */
export function extendOptions(timer: CookTimer): number[] {
  const base = [60, 120, 300];
  if (timer.rangeExtraSeconds > 0 && !base.includes(timer.rangeExtraSeconds)) {
    return [...base, timer.rangeExtraSeconds].sort((a, b) => a - b);
  }
  return base;
}
