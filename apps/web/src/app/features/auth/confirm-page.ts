import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { APP_NAME } from '../../app-name';
import { HOME } from '../../core/auth/auth.guards';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthFrame } from './auth-frame';

/**
 * Where the link in the sign-in email lands. Signing in waits for a tap, so email scanners that open links
 * can't use up the one-time token before the user does.
 */
@Component({
  selector: 'mise-confirm-page',
  imports: [AuthFrame, RouterLink],
  template: `
    <mise-auth-frame>
      @if (state() === 'failed') {
        <h1 class="page-title">This link has expired</h1>
        <p class="text-ink-muted">
          Sign-in links work once and expire after 10 minutes.
        </p>
        <a routerLink="/sign-in" class="btn btn-primary no-underline">
          Get a new code
        </a>
      } @else {
        <h1 class="page-title">Sign in to {{ appName }}</h1>
        <p class="text-ink-muted">
          Continue to finish signing in on this device.
        </p>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="state() === 'working'"
          (click)="continue()"
        >
          {{ state() === 'working' ? 'Signing in…' : 'Continue' }}
        </button>
        <p class="min-h-6 font-semibold text-danger" role="alert">
          {{ problem() }}
        </p>
      }
    </mise-auth-frame>
  `,
})
export class ConfirmPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly tokenHash =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token_hash') ?? '';

  protected readonly appName = APP_NAME;
  protected readonly state = signal<'ready' | 'working' | 'failed'>(
    this.tokenHash ? 'ready' : 'failed',
  );
  protected readonly problem = signal('');

  protected async continue(): Promise<void> {
    this.state.set('working');
    this.problem.set('');
    const result = await this.auth.verifyLink(this.tokenHash);
    if (result.ok) {
      await this.router.navigateByUrl(HOME, { replaceUrl: true });
      return;
    }
    if (result.reason === 'network') {
      this.problem.set(
        'Couldn’t reach the server. Check your connection and try again.',
      );
      this.state.set('ready');
      return;
    }
    this.state.set('failed');
  }
}
