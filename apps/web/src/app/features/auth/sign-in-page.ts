import {
  Component,
  DestroyRef,
  ElementRef,
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
  maxLength,
  pattern,
  required,
  submit,
  type FieldTree,
} from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { safeNext } from '../../core/auth/auth.guards';
import type { AuthFailure } from '../../core/auth/auth.repository';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthFrame } from './auth-frame';

/** Matches `[auth.email] max_frequency` in supabase/config.toml for the hosted project. */
const RESEND_AFTER_MS = 60_000;

const PROBLEMS: Record<AuthFailure, string> = {
  'rate-limited': 'Too many attempts. Wait a minute, then try again.',
  'invalid-code': 'That code is wrong or has expired.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
  unknown: 'Something went wrong. Try again.',
};

/** Email sign-in: send a 6-digit code, then enter it (or tap the link in the email). */
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
            [disabled]="emailForm().submitting()"
          >
            {{ emailForm().submitting() ? 'Sending…' : 'Send code' }}
          </button>
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
              [formField]="codeForm.code"
              (input)="submitWhenComplete()"
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
            [disabled]="codeForm().submitting()"
          >
            {{ codeForm().submitting() ? 'Signing in…' : 'Sign in' }}
          </button>
          <div class="flex flex-wrap justify-between gap-x-4">
            <button type="button" class="btn btn-quiet" (click)="changeEmail()">
              Use a different email
            </button>
            <button
              type="button"
              class="btn btn-quiet"
              [disabled]="resendIn() > 0"
              (click)="resend()"
            >
              {{
                resendIn() > 0
                  ? 'New code in ' + resendIn() + 's'
                  : 'Send a new code'
              }}
            </button>
          </div>
          <p class="text-sm text-ink-muted">
            Using the installed app? Enter the code: the link opens in your
            browser instead.
          </p>
        </form>
      }

      <p class="min-h-6 font-semibold text-danger" role="alert">
        {{ problem() }}
      </p>
    </mise-auth-frame>
  `,
})
export class SignInPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly next = safeNext(
    inject(ActivatedRoute).snapshot.queryParamMap.get('next'),
  );

  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly sentTo = signal('');
  /** Problems that aren't about one field: rate limits, network. */
  protected readonly problem = signal('');

  protected readonly emailForm = form(
    signal({ email: '' }),
    (path) => {
      required(path.email, { message: 'Enter your email address.' });
      email(path.email, {
        message: 'That doesn’t look like an email address.',
      });
    },
    {
      submission: {
        action: async (fields) => {
          await this.send(fields.email().value().trim());
          return undefined;
        },
      },
    },
  );

  protected readonly codeForm = form(
    signal({ code: '' }),
    (path) => {
      required(path.code, { message: 'Enter the 6-digit code.' });
      maxLength(path.code, 6);
      pattern(path.code, /^\d{6}$/, { message: 'The code is 6 digits.' });
    },
    {
      submission: {
        action: async (fields) => {
          this.problem.set('');
          const result = await this.auth.verifyCode(
            this.sentTo(),
            fields.code().value(),
          );
          if (result.ok) {
            await this.router.navigateByUrl(this.next, { replaceUrl: true });
            return undefined;
          }
          if (result.reason === 'invalid-code')
            return {
              fieldTree: fields.code,
              kind: 'server',
              message: PROBLEMS['invalid-code'],
            };
          this.problem.set(PROBLEMS[result.reason]);
          return undefined;
        },
      },
    },
  );

  protected readonly emailError = computed(() =>
    errorFor(this.emailForm.email),
  );
  protected readonly codeError = computed(() => errorFor(this.codeForm.code));

  private readonly resendAt = signal(0);
  private readonly now = signal(Date.now());
  protected readonly resendIn = computed(() =>
    Math.max(0, Math.ceil((this.resendAt() - this.now()) / 1000)),
  );

  private readonly codeInput =
    viewChild<ElementRef<HTMLInputElement>>('codeInput');

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
    // Move focus to the code field when it appears.
    effect(() => this.codeInput()?.nativeElement.focus());
  }

  protected submitWhenComplete(): void {
    if (
      /^\d{6}$/.test(this.codeForm.code().value()) &&
      !this.codeForm().submitting()
    )
      void submit(this.codeForm);
  }

  protected changeEmail(): void {
    this.problem.set('');
    this.codeForm.code().value.set('');
    this.step.set('email');
  }

  protected async resend(): Promise<void> {
    this.codeForm.code().value.set('');
    await this.send(this.sentTo());
  }

  private async send(address: string): Promise<void> {
    this.problem.set('');
    const result = await this.auth.sendCode(address);
    if (!result.ok) {
      this.problem.set(PROBLEMS[result.reason]);
      return;
    }
    this.sentTo.set(address);
    this.resendAt.set(Date.now() + RESEND_AFTER_MS);
    this.now.set(Date.now());
    this.step.set('code');
  }
}

/** The first error to show for a field, once the user has left it or tried to submit. */
function errorFor(field: FieldTree<string>): string {
  const state = field();
  return state.touched() ? (state.errors()[0]?.message ?? '') : '';
}
