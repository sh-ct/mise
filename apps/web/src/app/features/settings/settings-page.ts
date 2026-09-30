import { Component, inject } from '@angular/core';
import { APPEARANCES, type Appearance } from '../../core/theme/appearance';
import { ThemeStore } from '../../core/theme/theme.store';
import { THEMES, type ThemeId } from '../../core/theme/themes';

const APPEARANCE_HINTS: Record<Appearance, string> = {
  light: 'Light all the time.',
  dark: 'Dark all the time.',
  time: 'Dark from 7pm to 7am.',
  system: 'Follows your device’s light or dark setting.',
};

@Component({
  selector: 'mise-settings-page',
  template: `
    <h1 class="heading text-3xl md:text-4xl">Settings</h1>

    <fieldset class="mt-6 grid gap-3">
      <legend class="heading mb-3 text-lg">Appearance</legend>
      <div class="grid gap-2 sm:grid-cols-2">
        @for (option of appearances; track option.value) {
          <label
            class="flex min-h-14 cursor-pointer items-start gap-3 card-edge rounded-card bg-surface p-4 has-[:checked]:outline-2 has-[:checked]:outline-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
          >
            <input
              type="radio"
              name="appearance"
              class="mt-1 size-4 accent-primary"
              [value]="option.value"
              [checked]="theme.appearance() === option.value"
              (change)="theme.setAppearance(option.value)"
            />
            <span class="grid gap-0.5">
              <span class="font-semibold">{{ option.label }}</span>
              <span class="text-sm text-ink-muted">{{
                hints[option.value]
              }}</span>
            </span>
          </label>
        }
      </div>
      <p class="text-sm text-ink-muted" aria-live="polite">
        Currently {{ theme.mode() }}.
      </p>
    </fieldset>

    <fieldset class="mt-8 grid gap-3">
      <legend class="heading mb-3 text-lg">Style</legend>
      <div class="grid gap-2 sm:grid-cols-2">
        @for (option of themes; track option.id) {
          <label
            class="flex min-h-14 cursor-pointer items-center gap-3 card-edge rounded-card bg-surface p-4 has-[:checked]:outline-2 has-[:checked]:outline-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
          >
            <input
              type="radio"
              name="theme"
              class="size-4 accent-primary"
              [value]="option.id"
              [checked]="theme.themeId() === option.id"
              (change)="setTheme(option.id)"
            />
            <span class="font-semibold">{{ option.label }}</span>
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeStore);
  protected readonly appearances = APPEARANCES;
  protected readonly themes = THEMES;
  protected readonly hints = APPEARANCE_HINTS;

  protected setTheme(id: ThemeId): void {
    this.theme.setTheme(id);
  }
}
