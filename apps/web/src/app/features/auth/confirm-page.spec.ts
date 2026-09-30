import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
  fakeSession,
  provideFakeAuth,
} from '../../../testing/fake-auth';
import { ConfirmPage } from './confirm-page';

@Component({ template: '' })
class Blank {}

describe('ConfirmPage', () => {
  let repository: FakeAuthRepository;

  async function render(url: string) {
    repository = new FakeAuthRepository();
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(repository),
        provideRouter([
          { path: 'auth/confirm', component: ConfirmPage },
          { path: '**', component: Blank },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, el: harness.routeNativeElement as HTMLElement };
  }

  const button = (el: HTMLElement) => el.querySelector('button');

  it('waits for a tap, then signs in with the link and goes home', async () => {
    const { harness, el } = await render(
      '/auth/confirm?token_hash=abc&type=email',
    );
    expect(repository.verifyLink).not.toHaveBeenCalled();
    button(el)?.click();
    await harness.fixture.whenStable();
    expect(repository.verifyLink).toHaveBeenCalledWith('abc');
    expect(TestBed.inject(Router).url).toBe('/recipes');
  });

  it('offers a new code when the link has expired or was used', async () => {
    const { harness, el } = await render('/auth/confirm?token_hash=old');
    repository.result = { ok: false, reason: 'invalid-code' };
    button(el)?.click();
    await harness.fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain('expired');
    expect(document.activeElement).toBe(el.querySelector('h1'));
    expect(el.querySelector('a[href="/sign-in"]')).not.toBeNull();
  });

  it('keeps the link usable after a network problem', async () => {
    const { harness, el } = await render('/auth/confirm?token_hash=abc');
    repository.result = { ok: false, reason: 'network' };
    button(el)?.click();
    await harness.fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Couldn’t reach the server',
    );
    expect(button(el)?.getAttribute('aria-disabled')).toBeNull();
  });

  it('asks a signed-in user before a link replaces their session', async () => {
    const { harness, el } = await render('/auth/confirm?token_hash=abc');
    repository.setSession(fakeSession('me@example.test'));
    await harness.fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain('already signed in');
    expect(el.textContent).toContain('me@example.test');
    expect(repository.verifyLink).not.toHaveBeenCalled();

    button(el)?.click();
    await harness.fixture.whenStable();
    expect(repository.verifyLink).toHaveBeenCalledWith('abc');
    expect(TestBed.inject(Router).url).toBe('/recipes');
  });

  it('keeps the link usable after a rate limit or server error', async () => {
    const { harness, el } = await render('/auth/confirm?token_hash=abc');
    repository.result = { ok: false, reason: 'unknown' };
    button(el)?.click();
    await harness.fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).not.toContain('expired');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Something went wrong',
    );
  });

  it('takes the token out of the address bar straight away', async () => {
    await render('/auth/confirm?token_hash=abc');
    expect(TestBed.inject(Location).path()).toBe('/auth/confirm');
  });

  it('treats a link without a token as expired', async () => {
    const { el } = await render('/auth/confirm');
    expect(el.querySelector('h1')?.textContent).toContain('expired');
  });
});
