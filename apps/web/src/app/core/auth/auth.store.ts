import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { Session } from '@supabase/supabase-js';
import { AuthRepository } from './auth.repository';

/** `loading` until the saved session (if any) has been read at startup. */
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

interface AuthState {
  session: Session | null;
  status: AuthStatus;
}

/** The signed-in session, kept in step with Supabase (including sign-in or sign-out in another tab). */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ session: null, status: 'loading' }),
  withProps(() => ({ _repository: inject(AuthRepository) })),
  withComputed(({ session }) => ({
    email: computed(() => session()?.user.email ?? ''),
  })),
  withMethods(({ _repository }) => ({
    sendCode: (email: string) => _repository.sendCode(email),
    verifyCode: (email: string, code: string) =>
      _repository.verifyCode(email, code),
    verifyLink: (tokenHash: string) => _repository.verifyLink(tokenHash),
    signOut: () => _repository.signOut(),
  })),
  withHooks((store) => {
    let unsubscribe: (() => void) | undefined;
    return {
      onInit() {
        unsubscribe = store._repository.watchSession((session) =>
          patchState(store, {
            session,
            status: session ? 'signed-in' : 'signed-out',
          }),
        );
      },
      onDestroy() {
        unsubscribe?.();
      },
    };
  }),
);
