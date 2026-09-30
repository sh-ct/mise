import type { AuthFailure } from '../../core/auth/auth-result';

export const AUTH_PROBLEMS: Record<AuthFailure, string> = {
  'invalid-email': 'That doesn’t look like an email address.',
  'invalid-code': 'That code is wrong or has expired.',
  'rate-limited': 'Too many attempts. Wait a minute, then try again.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
  unknown: 'Something went wrong. Try again.',
};
