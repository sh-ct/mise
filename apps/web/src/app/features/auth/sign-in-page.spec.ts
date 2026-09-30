import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
  provideFakeAuth,
} from '../../../testing/fake-auth';
import { SignInPage } from './sign-in-page';

@Component({ template: '' })
class Blank {}

describe('SignInPage', () => {
  let repository: FakeAuthRepository;

  async function render(url = '/sign-in') {
    repository = new FakeAuthRepository();
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(repository),
        provideRouter([
          { path: 'sign-in', component: SignInPage },
          { path: '**', component: Blank },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, el: harness.routeNativeElement as HTMLElement };
  }

  function type(input: HTMLInputElement | null, value: string) {
    if (!input) throw new Error('input not found');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const submitButton = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('button[type="submit"]');

  async function sendCode(el: HTMLElement, harness: RouterTestingHarness) {
    type(el.querySelector('#email'), ' cook@example.test ');
    submitButton(el)?.click();
    await harness.fixture.whenStable();
  }

  it('asks for a valid email before sending', async () => {
    const { harness, el } = await render();
    submitButton(el)?.click();
    await harness.fixture.whenStable();
    expect(el.querySelector('#email-error')?.textContent).toContain(
      'Enter your email address.',
    );
    expect(el.querySelector('#email')?.getAttribute('aria-invalid')).toBe(
      'true',
    );

    type(el.querySelector('#email'), 'not-an-email');
    await harness.fixture.whenStable();
    expect(el.querySelector('#email-error')?.textContent).toContain(
      'doesn’t look like an email address',
    );
    expect(repository.sendCode).not.toHaveBeenCalled();
  });

  it('sends a code to the trimmed address and asks for it', async () => {
    const { harness, el } = await render();
    await sendCode(el, harness);
    expect(repository.sendCode).toHaveBeenCalledWith('cook@example.test');
    expect(el.textContent).toContain('cook@example.test');
    expect(document.activeElement?.id).toBe('code');
    expect(el.textContent).toContain('New code in 60s');
  });

  it('signs in when the sixth digit is entered and goes where the user was heading', async () => {
    const { harness, el } = await render('/sign-in?next=%2Fsettings');
    await sendCode(el, harness);
    type(el.querySelector('#code'), '123456');
    await harness.fixture.whenStable();
    expect(repository.verifyCode).toHaveBeenCalledWith(
      'cook@example.test',
      '123456',
    );
    expect(TestBed.inject(Router).url).toBe('/settings');
  });

  it('shows a wrong or expired code on the field', async () => {
    const { harness, el } = await render();
    await sendCode(el, harness);
    repository.result = { ok: false, reason: 'invalid-code' };
    type(el.querySelector('#code'), '000000');
    await harness.fixture.whenStable();
    expect(el.querySelector('#code-error')?.textContent).toContain(
      'wrong or has expired',
    );
    expect(TestBed.inject(Router).url).toBe('/sign-in');
  });

  it('explains rate limits and network problems without leaving the step', async () => {
    const { harness, el } = await render();
    repository.result = { ok: false, reason: 'rate-limited' };
    await sendCode(el, harness);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Too many attempts',
    );
    expect(el.querySelector('#email')).not.toBeNull();
  });

  it('goes back to change the email', async () => {
    const { harness, el } = await render();
    await sendCode(el, harness);
    const back = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Use a different email'),
    );
    back?.click();
    await harness.fixture.whenStable();
    expect(el.querySelector('#email')).not.toBeNull();
  });
});
