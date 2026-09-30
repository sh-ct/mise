import { Injectable, inject } from '@angular/core';
import {
  isAuthRetryableFetchError,
  type AuthError,
  type Session,
} from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase';
import type { AuthFailure, AuthResult } from './auth-result';

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
    // An unknown address is reported as sent, so the form doesn't say who has an account. (GoTrue's own API
    // still answers differently; see docs/ARCHITECTURE.md#auth.)
    if (error?.code === 'otp_disabled' || error?.code === 'signup_disabled')
      return OK;
    return toResult(error, EMAIL_ERRORS);
  }

  async verifyCode(email: string, code: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    return toResult(error, TOKEN_ERRORS);
  }

  /** Completes sign-in from the link in the email (its token hash). */
  async verifyLink(tokenHash: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });
    return toResult(error, TOKEN_ERRORS);
  }

  /** Signs out this device. supabase-js clears the local session even when the server call fails. */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut({ scope: 'local' });
  }
}

/** GoTrue error codes that mean the user's input was wrong, per call. */
const EMAIL_ERRORS: Record<string, AuthFailure> = {
  validation_failed: 'invalid-email',
  email_address_invalid: 'invalid-email',
};
const TOKEN_ERRORS: Record<string, AuthFailure> = {
  otp_expired: 'invalid-code',
  validation_failed: 'invalid-code',
};

function toResult(
  error: AuthError | null,
  inputErrors: Record<string, AuthFailure>,
): AuthResult {
  if (!error) return OK;
  if (isAuthRetryableFetchError(error)) return { ok: false, reason: 'network' };
  if (error.status === 429 || error.code?.startsWith('over_'))
    return { ok: false, reason: 'rate-limited' };
  const input = inputErrors[error.code ?? ''];
  if (input) return { ok: false, reason: input };
  console.error(error);
  return { ok: false, reason: 'unknown' };
}
