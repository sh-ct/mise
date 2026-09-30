import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from './auth.store';
import { safeNext } from './redirect';

/** Signed-in pages: otherwise go to sign-in, remembering where the user was heading. */
export const signedInGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenSettled();
  return (
    auth.status() === 'signed-in' ||
    router.createUrlTree(['/sign-in'], {
      queryParams: state.url === '/' ? {} : { next: state.url },
    })
  );
};

/** The sign-in page: already signed in means straight through to where the user was heading. */
export const signedOutGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenSettled();
  return (
    auth.status() === 'signed-out' ||
    router.parseUrl(safeNext(route.queryParamMap.get('next')))
  );
};
