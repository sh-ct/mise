import { Location } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { HOME } from '../../core/auth/redirect';
import { AuthFrame } from './auth-frame';
import { AUTH_PROBLEMS } from './auth-messages';

/**
 * Where the link in the sign-in email lands. Signing in waits for a tap, so email scanners that open links
 * can't use up the one-time token, and someone already signed in is asked before a link (perhaps forwarded
 * by someone else) replaces their session. The token leaves the address bar and history straight away.
 */
@Component({
  selector: 'mise-confirm-page',
  imports: [AuthFrame, RouterLink],
  template: `
    <mise-auth-frame>
      @if (state() === 'failed') {
        <h1 #expiredHeading tabindex="-1" class="page-title focus:outline-none">
          This link has expired
        </h1>
        <p class="text-ink-muted">
          Sign-in links work once and expire after 10 minutes.
        </p>
        <a routerLink="/sign-in" class="btn btn-primary">Get a new code</a>
      } @else if (signedInAs(); as email) {
        <h1 class="page-title">You’re already signed in</h1>
        <p class="text-ink-muted">
          This device is signed in as
          <strong class="text-ink">{{ email }}</strong
          >. The link may be for a different account.
        </p>
        <a [routerLink]="home" class="btn btn-primary"
          >Continue as {{ email }}</a
        >
        <button
          type="button"
          class="btn btn-secondary"
          [attr.aria-disabled]="state() === 'working' || null"
          (click)="continue()"
        >
          {{ state() === 'working' ? 'Signing in…' : 'Use the link’s account' }}
        </button>
        <p class="min-h-6 font-semibold text-danger" role="alert">
          {{ problem() }}
        </p>
      } @else {
        <h1 class="page-title">Finish signing in</h1>
        <p class="text-ink-muted">Continue to sign in on this device.</p>
        <button
          type="button"
          class="btn btn-primary"
          [attr.aria-disabled]="state() === 'working' || null"
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
  private readonly injector = inject(Injector);
  private readonly tokenHash =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token_hash') ?? '';

  protected readonly home = HOME;
  protected readonly state = signal<'ready' | 'working' | 'failed'>(
    this.tokenHash ? 'ready' : 'failed',
  );
  protected readonly problem = signal('');
  /** Set once sign-in succeeds, so the page doesn't flip to "already signed in" on its way out. */
  private readonly done = signal(false);
  protected readonly signedInAs = computed(() =>
    this.auth.status() === 'signed-in' && !this.done() ? this.auth.email() : '',
  );

  private readonly expiredHeading =
    viewChild<ElementRef<HTMLElement>>('expiredHeading');

  constructor() {
    inject(Location).replaceState('/auth/confirm');
  }

  protected async continue(): Promise<void> {
    if (this.state() === 'working') return;
    this.state.set('working');
    this.problem.set('');
    const result = await this.auth.verifyLink(this.tokenHash);
    if (result.ok) {
      this.done.set(true);
      await this.router.navigateByUrl(HOME, { replaceUrl: true });
      return;
    }
    if (result.reason !== 'invalid-code') {
      this.problem.set(AUTH_PROBLEMS[result.reason]);
      this.state.set('ready');
      return;
    }
    this.state.set('failed');
    afterNextRender(() => this.expiredHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
