import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_NAME } from './app-name';
import { ICONS, Icon } from './shared/ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * App shell. Mobile first: a top bar and a bottom tab bar within thumb reach, which also suits tablets.
 * From the `lg` breakpoint (desktop) navigation moves to a sidebar.
 */
@Component({
  selector: 'mise-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
})
export class App {
  protected readonly appName = APP_NAME;

  protected readonly nav: NavItem[] = [
    { path: '/recipes', label: 'Recipes', icon: ICONS.recipes },
    { path: '/settings', label: 'Settings', icon: ICONS.settings },
  ];
}
