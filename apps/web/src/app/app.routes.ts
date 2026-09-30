import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'recipes' },
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
      import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'recipes' },
];
