import type { Provider } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import {
  AuthRepository,
  type AuthResult,
} from '../app/core/auth/auth.repository';

type Listener = (session: Session | null) => void;

/** Stands in for AuthRepository in unit tests: no network, sessions set by hand or by a successful verify. */
export class FakeAuthRepository {
  private session: Session | null;
  private readonly listeners = new Set<Listener>();

  /** The result the next auth call returns. */
  result: AuthResult = { ok: true };

  constructor(email?: string) {
    this.session = email ? fakeSession(email) : null;
  }

  readonly sendCode = vi.fn(async (_email: string) => this.result);
  readonly verifyCode = vi.fn(async (email: string, _code: string) =>
    this.signInIfOk(email),
  );
  readonly verifyLink = vi.fn(async (_tokenHash: string) =>
    this.signInIfOk('link@example.test'),
  );
  readonly signOut = vi.fn(async () => {
    if (this.result.ok) this.setSession(null);
    return this.result;
  });

  watchSession(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.session);
    return () => this.listeners.delete(listener);
  }

  setSession(session: Session | null): void {
    this.session = session;
    for (const listener of this.listeners) listener(session);
  }

  private signInIfOk(email: string): AuthResult {
    if (this.result.ok) this.setSession(fakeSession(email));
    return this.result;
  }
}

export function fakeSession(email: string): Session {
  return { user: { email } } as Session;
}

export function provideFakeAuth(repository: FakeAuthRepository): Provider {
  return { provide: AuthRepository, useValue: repository };
}
