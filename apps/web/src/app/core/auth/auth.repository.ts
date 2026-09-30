import { Injectable, inject } from '@angular/core';
import {
  isAuthRetryableFetchError,
  type AuthError,
  type Session,
} from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase';

/** Why an auth call failed, in terms the UI can explain. */
export type AuthFailure =
  'rate-limited' | 'invalid-code' | 'network' | 'unknown';

export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure };

const OK: AuthResult = { ok: true };

/**
 * Email sign-in with a 6-digit code or a link (docs/ARCHITECTURE.md#auth). Sign-up is off: only existing users
 * get a code.
 */
@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly supabase = inject(SUPABASE);

  /** Calls back with the current session straight away and on every change; returns an unsubscribe function. */
  watchSession(callback: (session: Session | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) =>
      callback(session),
    );
    return () => data.subscription.unsubscribe();
  }

  async sendCode(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    // An unknown address is reported as sent, so the form can't be used to discover who has an account.
    if (
      error &&
      ['otp_disabled', 'signup_disabled', 'user_not_found'].includes(
        error.code ?? '',
      )
    )
      return OK;
    return toResult(error);
  }

  async verifyCode(email: string, code: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    return toResult(error);
  }

  /** Completes sign-in from the link in the email (its token hash). */
  async verifyLink(tokenHash: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });
    return toResult(error);
  }

  /** Signs out this device only. */
  async signOut(): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    return toResult(error);
  }
}

function toResult(error: AuthError | null): AuthResult {
  if (!error) return OK;
  if (isAuthRetryableFetchError(error)) return { ok: false, reason: 'network' };
  if (error.status === 429 || error.code?.startsWith('over_'))
    return { ok: false, reason: 'rate-limited' };
  if (error.code === 'otp_expired' || error.code === 'validation_failed')
    return { ok: false, reason: 'invalid-code' };
  console.error(error);
  return { ok: false, reason: 'unknown' };
}
