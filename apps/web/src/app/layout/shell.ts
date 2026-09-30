import { Component, effect, inject, untracked } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { APP_NAME } from '../app-name';
import { AuthStore } from '../core/auth/auth.store';
import { AppUpdateStore } from '../core/pwa/app-update.store';
import { ICONS, Icon } from '../shared/ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Layout for signed-in pages. Mobile first: a top bar and a bottom tab bar within thumb reach, which also
 * suits tablets. From the `lg` breakpoint (desktop) navigation moves to a sidebar.
 */
@Component({
  selector: 'mise-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly appName = APP_NAME;
  protected readonly update = inject(AppUpdateStore);

  protected readonly nav: NavItem[] = [
    { path: '/recipes', label: 'Recipes', icon: ICONS.recipes },
    { path: '/settings', label: 'Settings', icon: ICONS.settings },
  ];

  constructor() {
    // Signing out here, in another tab or by session expiry all land on the sign-in page, which returns here.
    const auth = inject(AuthStore);
    const router = inject(Router);
    effect(() => {
      if (auth.status() === 'signed-out')
        void router.navigate(['/sign-in'], {
          queryParams: { next: untracked(() => router.url) },
        });
    });
  }
}
