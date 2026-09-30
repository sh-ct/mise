import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
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
    expect(button(el)?.disabled).toBe(false);
  });

  it('treats a link without a token as expired', async () => {
    const { el } = await render('/auth/confirm');
    expect(el.querySelector('h1')?.textContent).toContain('expired');
  });
});
