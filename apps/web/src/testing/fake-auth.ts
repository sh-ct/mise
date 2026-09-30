import type { Provider } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import type { AuthResult } from '../app/core/auth/auth-result';
import { AuthRepository } from '../app/core/auth/auth.repository';

type Listener = (session: Session | null) => void;

/**
 * Stands in for AuthRepository in unit tests: no network; sessions are set by hand or by a successful verify.
 * With `{ settled: false }` the saved session isn't reported until `settle()`, like a slow startup.
 */
export class FakeAuthRepository implements Pick<
  AuthRepository,
  keyof AuthRepository
> {
  private session: Session | null;
  private settled: boolean;
  private readonly listeners = new Set<Listener>();

  /** The result the next auth call returns. */
  result: AuthResult = { ok: true };

  constructor(email?: string, { settled = true } = {}) {
    this.session = email ? fakeSession(email) : null;
    this.settled = settled;
  }

  readonly sendCode = vi.fn<AuthRepository['sendCode']>(
    async () => this.result,
  );
  readonly verifyCode = vi.fn<AuthRepository['verifyCode']>(async (email) =>
    this.signInIfOk(email),
  );
  readonly verifyLink = vi.fn<AuthRepository['verifyLink']>(async () =>
    this.signInIfOk('link@example.test'),
  );
  /** Like supabase-js with `scope: 'local'`: the local session goes even if the server call fails. */
  readonly signOut = vi.fn<AuthRepository['signOut']>(async () =>
    this.setSession(null),
  );

  watchSession(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.settled) listener(this.session);
    return () => this.listeners.delete(listener);
  }

  settle(): void {
    this.settled = true;
    this.setSession(this.session);
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
