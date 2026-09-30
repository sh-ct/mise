import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
  fakeSession,
  provideFakeAuth,
} from '../../../testing/fake-auth';
import { SignInPage } from './sign-in-page';

@Component({ template: '' })
class Blank {}

describe('SignInPage', () => {
  let repository: FakeAuthRepository;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

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
    harness = await RouterTestingHarness.create(url);
    el = harness.routeNativeElement as HTMLElement;
  }

  const stable = () => harness.fixture.whenStable();
  const input = (id: string) => {
    const found = el.querySelector<HTMLInputElement>(`#${id}`);
    if (!found) throw new Error(`#${id} not found`);
    return found;
  };
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(text),
    );
  const alertText = () => el.querySelector('[role="alert"]')?.textContent;
  const url = () => TestBed.inject(Router).url;

  async function type(id: string, value: string) {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
    await stable();
  }

  async function sendCode(address = 'cook@example.test') {
    await type('email', address);
    button('Send code')?.click();
    await stable();
  }

  it('asks for a valid email before sending, and focuses the field', async () => {
    await render();
    button('Send code')?.click();
    await stable();
    expect(el.querySelector('#email-error')?.textContent).toContain(
      'Enter your email address.',
    );
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('email'));

    await type('email', 'not-an-email');
    expect(el.querySelector('#email-error')?.textContent).toContain(
      'doesn’t look like an email address',
    );
    expect(repository.sendCode).not.toHaveBeenCalled();
  });

  it('shows an address the server rejects on the email field', async () => {
    await render();
    repository.result = { ok: false, reason: 'invalid-email' };
    await sendCode('odd@example.test');
    expect(el.querySelector('#email-error')?.textContent).toContain(
      'doesn’t look like an email address',
    );
  });

  it('sends a code and asks for it', async () => {
    await render();
    await sendCode();
    expect(repository.sendCode).toHaveBeenCalledWith('cook@example.test');
    expect(el.textContent).toContain('cook@example.test');
    expect(document.activeElement).toBe(input('code'));
    expect(el.textContent).toContain('New code in 60s');
    expect(input('code').getAttribute('aria-invalid')).toBe('false');
  });

  it('signs in on the sixth digit and goes where the user was heading', async () => {
    await render('/sign-in?next=%2Fsettings');
    await sendCode();
    await type('code', '123456');
    expect(repository.verifyCode).toHaveBeenCalledWith(
      'cook@example.test',
      '123456',
    );
    expect(url()).toBe('/settings');
  });

  it('accepts a pasted code with spaces', async () => {
    await render();
    await sendCode();
    await type('code', ' 123 456 ');
    expect(input('code').value).toBe('123456');
    expect(repository.verifyCode).toHaveBeenCalledWith(
      'cook@example.test',
      '123456',
    );
  });

  it('shows a wrong code on the field and selects it for the next try', async () => {
    await render();
    await sendCode();
    repository.result = { ok: false, reason: 'invalid-code' };
    await type('code', '000000');
    expect(el.querySelector('#code-error')?.textContent).toContain(
      'wrong or has expired',
    );
    expect(document.activeElement).toBe(input('code'));
    expect(input('code').selectionEnd).toBe(6);
    expect(url()).toBe('/sign-in');
  });

  it('explains problems that are not about a field, next to the button', async () => {
    await render();
    repository.result = { ok: false, reason: 'rate-limited' };
    await sendCode();
    expect(alertText()).toContain('Too many attempts');
    expect(el.querySelector('#email')).not.toBeNull();

    repository.result = { ok: true };
    await sendCode();
    repository.result = { ok: false, reason: 'network' };
    await type('code', '123456');
    expect(alertText()).toContain('Couldn’t reach the server');
  });

  it('goes back to change the email without complaining about the code', async () => {
    await render();
    await sendCode();
    input('code').focus();
    button('Use a different email')?.click();
    await stable();
    expect(document.activeElement).toBe(input('email'));

    await sendCode('other@example.test');
    expect(el.querySelector('#code-error')).toBeNull();
  });

  it('offers a new code after a minute, and confirms it was sent', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      await render();
      await sendCode();
      expect(button('Send a new code')).toBeUndefined();

      vi.advanceTimersByTime(30_000);
      await stable();
      expect(el.textContent).toContain('New code in 30s');

      vi.advanceTimersByTime(30_000);
      await stable();
      button('Send a new code')?.click();
      await stable();
      expect(repository.sendCode).toHaveBeenCalledTimes(2);
      expect(el.querySelector('[role="status"]')?.textContent).toContain(
        'We sent a new code.',
      );
      expect(document.activeElement).toBe(input('code'));
      expect(el.textContent).toContain('New code in 60s');
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves on when the session arrives some other way (link in another tab)', async () => {
    await render('/sign-in?next=%2Fsettings');
    await sendCode();
    repository.setSession(fakeSession('cook@example.test'));
    await stable();
    expect(url()).toBe('/settings');
  });
});
