import { TestBed } from '@angular/core/testing';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { SUPABASE, type Supabase } from '../supabase/supabase';
import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  const auth = {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  };

  beforeEach(() => {
    for (const fn of Object.values(auth)) fn.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE, useValue: { auth } as unknown as Supabase },
      ],
    });
  });

  const repository = () => TestBed.inject(AuthRepository);
  const apiError = (status: number, code: string) =>
    new AuthApiError('message', status, code);

  it('sends a code only to existing users', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    expect(await repository().sendCode('a@example.test')).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@example.test',
      options: { shouldCreateUser: false },
    });
  });

  it('reports an unknown address as sent, so accounts cannot be discovered', async () => {
    auth.signInWithOtp.mockResolvedValue({
      error: apiError(422, 'otp_disabled'),
    });
    expect(await repository().sendCode('nobody@example.test')).toEqual({
      ok: true,
    });
  });

  it.each([
    [apiError(429, 'over_email_send_rate_limit'), 'rate-limited'],
    [apiError(403, 'otp_expired'), 'invalid-code'],
    [new AuthRetryableFetchError('offline', 0), 'network'],
  ])('maps %s to %s', async (error, reason) => {
    auth.verifyOtp.mockResolvedValue({ error });
    expect(await repository().verifyCode('a@example.test', '123456')).toEqual({
      ok: false,
      reason,
    });
  });

  it('logs and reports unexpected errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.verifyOtp.mockResolvedValue({
      error: apiError(500, 'unexpected_failure'),
    });
    expect(await repository().verifyLink('hash')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('verifies codes and links as email OTPs', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    await repository().verifyCode('a@example.test', '123456');
    await repository().verifyLink('hash');
    expect(auth.verifyOtp).toHaveBeenNthCalledWith(1, {
      email: 'a@example.test',
      token: '123456',
      type: 'email',
    });
    expect(auth.verifyOtp).toHaveBeenNthCalledWith(2, {
      token_hash: 'hash',
      type: 'email',
    });
  });

  it('signs out this device only', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await repository().signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('passes session changes on and unsubscribes', () => {
    const unsubscribe = vi.fn();
    auth.onAuthStateChange.mockImplementation((callback) => {
      callback('INITIAL_SESSION', null);
      return { data: { subscription: { unsubscribe } } };
    });
    const seen: unknown[] = [];
    const stop = repository().watchSession((session) => seen.push(session));
    stop();
    expect(seen).toEqual([null]);
    expect(unsubscribe).toHaveBeenCalled();
  });
});
