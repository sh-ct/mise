import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormField,
  FormRoot,
  email,
  form,
  pattern,
  required,
  submit,
  type FieldTree,
} from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { safeNext } from '../../core/auth/redirect';
import { AuthFrame } from './auth-frame';
import { AUTH_PROBLEMS } from './auth-messages';

const CODE = /^\d{6}$/;

/** Matches `[auth.email] max_frequency` in supabase/config.toml for the hosted project. */
const RESEND_AFTER_MS = 60_000;

/**
 * Email sign-in: send a 6-digit code, then enter it (or tap the link in the email). Busy buttons stay enabled
 * (`aria-disabled`) so their "Sending…" label keeps full contrast and focus; repeat taps are ignored.
 */
@Component({
  selector: 'mise-sign-in-page',
  imports: [AuthFrame, FormRoot, FormField],
  template: `
    <mise-auth-frame>
      <h1 class="page-title">Sign in</h1>

      @if (step() === 'email') {
        <form [formRoot]="emailForm" novalidate class="grid gap-5">
          <p class="text-ink-muted">We’ll email you a 6-digit code.</p>
          <div class="grid gap-1.5">
            <label for="email" class="font-semibold">Email</label>
            <input
              id="email"
              class="field"
              type="email"
              autocomplete="email"
              autocapitalize="none"
              spellcheck="false"
              enterkeyhint="send"
              [formField]="emailForm.email"
              [attr.aria-invalid]="!!emailError()"
              [attr.aria-describedby]="emailError() ? 'email-error' : null"
            />
            @if (emailError(); as message) {
              <p id="email-error" class="text-sm font-semibold text-danger">
                {{ message }}
              </p>
            }
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            [attr.aria-disabled]="emailForm().submitting() || null"
          >
            {{ emailForm().submitting() ? 'Sending…' : 'Send code' }}
          </button>
          <p class="min-h-6 font-semibold text-danger" role="alert">
            {{ problem() }}
          </p>
        </form>
      } @else {
        <form [formRoot]="codeForm" novalidate class="grid gap-5">
          <p id="code-hint" class="text-ink-muted">
            If <strong class="text-ink">{{ sentTo() }}</strong> has an account,
            a code is on its way. Enter it here, or tap the link in the email.
          </p>
          <div class="grid gap-1.5">
            <label for="code" class="font-semibold">Code</label>
            <input
              #codeInput
              id="code"
              class="field nums text-center text-2xl tracking-widest"
              inputmode="numeric"
              autocomplete="one-time-code"
              enterkeyhint="go"
              [formField]="codeForm.code"
              (input)="onCodeInput($event)"
              [attr.aria-invalid]="!!codeError()"
              [attr.aria-describedby]="
                codeError() ? 'code-hint code-error' : 'code-hint'
              "
            />
            @if (codeError(); as message) {
              <p id="code-error" class="text-sm font-semibold text-danger">
                {{ message }}
              </p>
            }
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            [attr.aria-disabled]="codeForm().submitting() || null"
          >
            {{ codeForm().submitting() ? 'Signing in…' : 'Sign in' }}
          </button>
          <p class="min-h-6 font-semibold text-danger" role="alert">
            {{ problem() }}
          </p>
          <!-- Negative margin lines the quiet buttons' text up with the field edges. -->
          <div
            class="-mx-5 flex flex-wrap items-center justify-between gap-x-4"
          >
            <button type="button" class="btn btn-quiet" (click)="changeEmail()">
              Use a different email
            </button>
            @if (resendIn() > 0) {
              <p class="px-5 text-ink-muted">New code in {{ resendIn() }}s</p>
            } @else {
              <button
                type="button"
                class="btn btn-quiet"
                [attr.aria-disabled]="busy() || null"
                (click)="resend()"
              >
                {{ sending() ? 'Sending…' : 'Send a new code' }}
              </button>
            }
          </div>
          <p class="min-h-5 text-sm text-ink-muted" role="status">
            {{ notice() }}
          </p>
          <p class="text-sm text-ink-muted">
            Using the installed app? Enter the code: the link opens in your
            browser instead.
          </p>
        </form>
      }
    </mise-auth-frame>
  `,
})
export class SignInPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly next = safeNext(
    inject(ActivatedRoute).snapshot.queryParamMap.get('next'),
  );

  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly sentTo = signal('');
  /** Problems that aren't about one field: rate limits, network. */
  protected readonly problem = signal('');
  /** Quiet confirmations, e.g. a new code sent. */
  protected readonly notice = signal('');
  protected readonly sending = signal(false);

  protected readonly emailForm = form(
    signal({ email: '' }),
    (path) => {
      required(path.email, { message: 'Enter your email address.' });
      email(path.email, { message: AUTH_PROBLEMS['invalid-email'] });
    },
    {
      submission: {
        action: async (fields) => {
          this.problem.set('');
          // type=email inputs already trim their value.
          const address = fields.email().value();
          const result = await this.auth.sendCode(address);
          if (result.ok) {
            this.showCodeStep(address);
            return undefined;
          }
          if (result.reason === 'invalid-email') {
            fields.email().focusBoundControl();
            return {
              fieldTree: fields.email,
              kind: 'server',
              message: AUTH_PROBLEMS['invalid-email'],
            };
          }
          this.problem.set(AUTH_PROBLEMS[result.reason]);
          return undefined;
        },
        onInvalid: (fields) => fields.email().focusBoundControl(),
      },
    },
  );

  protected readonly codeForm = form(
    signal({ code: '' }),
    (path) => {
      required(path.code, { message: 'Enter the 6-digit code.' });
      pattern(path.code, CODE, { message: 'The code is 6 digits.' });
    },
    {
      submission: {
        // On success the session changes and the constructor's effect moves on to `next`.
        action: async (fields) => {
          this.problem.set('');
          this.notice.set('');
          const result = await this.auth.verifyCode(
            this.sentTo(),
            fields.code().value(),
          );
          if (result.ok) return undefined;
          if (result.reason === 'invalid-code') {
            this.selectCode();
            return {
              fieldTree: fields.code,
              kind: 'server',
              message: AUTH_PROBLEMS['invalid-code'],
            };
          }
          this.problem.set(AUTH_PROBLEMS[result.reason]);
          return undefined;
        },
        onInvalid: () => this.selectCode(),
      },
    },
  );

  protected readonly emailError = computed(() =>
    errorFor(this.emailForm.email),
  );
  protected readonly codeError = computed(() => errorFor(this.codeForm.code));
  protected readonly busy = computed(
    () => this.sending() || this.codeForm().submitting(),
  );

  private readonly resendAt = signal(0);
  private readonly now = signal(Date.now());
  protected readonly resendIn = computed(() =>
    Math.max(0, Math.ceil((this.resendAt() - this.now()) / 1000)),
  );
  private clock: ReturnType<typeof setInterval> | undefined;

  private readonly codeInput =
    viewChild<ElementRef<HTMLInputElement>>('codeInput');

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.clock));
    // However the session arrives (this form, the email link in another tab, a refresh once back online),
    // move on to where the user was heading.
    effect(() => {
      if (this.auth.status() === 'signed-in')
        void this.router.navigateByUrl(this.next, { replaceUrl: true });
    });
  }

  /** Keeps digits only (codes pasted from email often carry spaces) and submits on the sixth. */
  protected onCodeInput(event: Event): void {
    const typed = (event.target as HTMLInputElement).value;
    const digits = typed.replace(/\D/g, '').slice(0, 6);
    if (digits !== typed) this.codeForm.code().value.set(digits);
    if (CODE.test(digits)) void submit(this.codeForm);
  }

  protected changeEmail(): void {
    this.problem.set('');
    this.notice.set('');
    this.codeForm().reset({ code: '' });
    this.step.set('email');
    this.afterRender(() => this.emailForm.email().focusBoundControl());
  }

  protected async resend(): Promise<void> {
    if (this.busy()) return;
    this.sending.set(true);
    this.problem.set('');
    this.notice.set('');
    const result = await this.auth.sendCode(this.sentTo());
    this.sending.set(false);
    if (!result.ok) {
      this.problem.set(AUTH_PROBLEMS[result.reason]);
      return;
    }
    this.startCooldown();
    this.codeForm().reset({ code: '' });
    this.notice.set('We sent a new code.');
    this.codeForm.code().focusBoundControl();
  }

  private showCodeStep(address: string): void {
    this.sentTo.set(address);
    this.startCooldown();
    this.codeForm().reset({ code: '' });
    this.step.set('code');
    this.afterRender(() => this.codeForm.code().focusBoundControl());
  }

  private startCooldown(): void {
    this.resendAt.set(Date.now() + RESEND_AFTER_MS);
    this.now.set(Date.now());
    clearInterval(this.clock);
    this.clock = setInterval(() => {
      this.now.set(Date.now());
      if (this.resendIn() === 0) clearInterval(this.clock);
    }, 1000);
  }

  /** Focus the code and select it, so the next attempt replaces a wrong one. */
  private selectCode(): void {
    const input = this.codeInput()?.nativeElement;
    input?.focus();
    input?.select();
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}

/** The first error to show for a field, once the user has left it or tried to submit. */
function errorFor(field: FieldTree<string>): string {
  const state = field();
  return state.touched() ? (state.errors()[0]?.message ?? '') : '';
}
