import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_NAME } from './app-name';
import { ThemeStore } from './core/theme/theme.store';

interface NavItem {
  path: string;
  label: string;
  /** SVG path data for a 24×24 stroked icon. */
  icon: string;
}

/**
 * App shell. Mobile first: a top bar and a bottom tab bar within thumb reach. From the `md` breakpoint
 * (tablets, desktop) navigation moves to a sidebar and content gets a readable max width.
 */
@Component({
  selector: 'mise-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected readonly appName = APP_NAME;
  // Injected here so the theme applies from the first render on every route.
  protected readonly theme = inject(ThemeStore);

  protected readonly nav: NavItem[] = [
    {
      path: '/recipes',
      label: 'Recipes',
      icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4z',
    },
  ];
}
