import { Route } from '@angular/router';
import { signedInGuard, signedOutGuard } from './core/auth/auth.guards';
import { HOME } from './core/auth/redirect';

export const appRoutes: Route[] = [
  {
    path: 'sign-in',
    title: 'Sign in',
    canActivate: [signedOutGuard],
    loadComponent: () =>
      import('./features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    // Target of the link in the sign-in email (supabase/templates/magic-link.html).
    path: 'auth/confirm',
    title: 'Sign in',
    loadComponent: () =>
      import('./features/auth/confirm-page').then((m) => m.ConfirmPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivateChild: [signedInGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: HOME },
      {
        path: 'recipes',
        title: 'Recipes',
        loadComponent: () =>
          import('./features/library/library-page').then((m) => m.LibraryPage),
      },
      {
        path: 'settings',
        title: 'Settings',
        loadComponent: () =>
          import('./features/settings/settings-page').then(
            (m) => m.SettingsPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
