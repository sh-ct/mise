/** Why an auth call failed, in terms the UI can explain. */
export type AuthFailure =
  'invalid-email' | 'invalid-code' | 'rate-limited' | 'network' | 'unknown';

export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure };
