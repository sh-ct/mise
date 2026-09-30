import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type CanActivateFn } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthStore, type AuthStatus } from './auth.store';

export const HOME = '/recipes';

/** A same-app path to return to after sign-in; anything else (other origins, `//host`) goes home. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/(?![/\\])/.test(next) ? next : HOME;
}

/** The auth status once the saved session has been read. */
function settledStatus() {
  return toObservable(inject(AuthStore).status).pipe(
    filter(
      (status): status is Exclude<AuthStatus, 'loading'> =>
        status !== 'loading',
    ),
    take(1),
  );
}

/** Signed-in pages: otherwise go to sign-in, remembering where the user was heading. */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return settledStatus().pipe(
    map(
      (status) =>
        status === 'signed-in' ||
        router.createUrlTree(['/sign-in'], {
          queryParams: state.url === '/' ? {} : { next: state.url },
        }),
    ),
  );
};

/** The sign-in page: already signed in means straight through to where the user was heading. */
export const signedOutGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  return settledStatus().pipe(
    map(
      (status) =>
        status === 'signed-out' ||
        router.parseUrl(safeNext(route.queryParamMap.get('next'))),
    ),
  );
};
