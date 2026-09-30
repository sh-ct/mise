import { Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { APPEARANCES } from '../../core/theme/appearance';
import { ThemeStore } from '../../core/theme/theme.store';
import { THEMES } from '../../core/theme/themes';

@Component({
  selector: 'mise-settings-page',
  template: `
    <h1 class="page-title">Settings</h1>

    <fieldset class="@container mt-6 grid gap-3">
      <legend class="mb-3"><h2 class="heading text-lg">Appearance</h2></legend>
      <div class="grid gap-2 @lg:grid-cols-2">
        @for (option of appearances; track option.value) {
          <label class="choice items-start">
            <input
              type="radio"
              name="appearance"
              class="mt-1 size-4"
              [value]="option.value"
              [checked]="theme.appearance() === option.value"
              (change)="theme.setAppearance(option.value)"
            />
            <span class="grid gap-0.5">
              <span class="font-semibold">{{ option.label }}</span>
              <span class="text-sm text-ink-muted">{{ option.hint }}</span>
            </span>
          </label>
        }
      </div>
      <p class="min-h-5 text-sm text-ink-muted" aria-live="polite">
        {{ status() }}
      </p>
    </fieldset>

    <fieldset class="@container mt-8 grid gap-3">
      <legend class="mb-3"><h2 class="heading text-lg">Style</h2></legend>
      <div class="grid gap-2 @lg:grid-cols-2">
        @for (option of themes; track option.id) {
          <label class="choice items-center">
            <input
              type="radio"
              name="theme"
              class="size-4"
              [value]="option.id"
              [checked]="theme.themeId() === option.id"
              (change)="theme.setTheme(option.id)"
            />
            <span class="grow font-semibold">{{ option.label }}</span>
            <!-- A live sample: this element renders in the option's own theme and the current mode. -->
            <span
              class="flex items-center gap-1.5 rounded-control border border-line bg-canvas px-2 py-1"
              [attr.data-theme]="option.id"
              [attr.data-mode]="theme.mode()"
              aria-hidden="true"
            >
              <span class="heading text-base text-ink">Aa</span>
              <span class="size-3.5 rounded-chip bg-primary"></span>
              <span class="size-3.5 rounded-chip bg-accent"></span>
              <span class="size-3.5 rounded-chip bg-chip"></span>
            </span>
          </label>
        }
      </div>
    </fieldset>

    <section class="mt-8 grid gap-3" aria-labelledby="account-heading">
      <h2 id="account-heading" class="heading text-lg">Account</h2>
      <p class="text-ink-muted">
        Signed in as <strong class="text-ink">{{ auth.email() }}</strong>
      </p>
      <div>
        <button
          type="button"
          class="btn btn-secondary"
          [disabled]="signingOut()"
          (click)="signOut()"
        >
          Sign out
        </button>
      </div>
      <p class="min-h-6 font-semibold text-danger" role="alert">
        {{ signOutProblem() }}
      </p>
    </section>
  `,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeStore);
  protected readonly auth = inject(AuthStore);
  protected readonly signingOut = signal(false);
  protected readonly signOutProblem = signal('');
  protected readonly appearances = APPEARANCES;
  protected readonly themes = THEMES;

  /** Only worth saying for the automatic modes, where the result isn't obvious from the choice. */
  protected readonly status = computed(() => {
    const appearance = this.theme.appearance();
    if (appearance !== 'time' && appearance !== 'system') return '';
    return this.theme.mode() === 'dark'
      ? 'Dark right now.'
      : 'Light right now.';
  });

  /** The shell sends the user to sign-in once the session ends. */
  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    this.signOutProblem.set('');
    const result = await this.auth.signOut();
    this.signingOut.set(false);
    if (!result.ok) this.signOutProblem.set('Couldn’t sign out. Try again.');
  }
}
