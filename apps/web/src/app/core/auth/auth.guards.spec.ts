import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
  provideFakeAuth,
} from '../../../testing/fake-auth';
import { safeNext, signedInGuard, signedOutGuard } from './auth.guards';

@Component({ template: '' })
class Blank {}

describe('safeNext', () => {
  it.each([
    ['/settings', '/settings'],
    ['/recipes?q=soup', '/recipes?q=soup'],
    [null, '/recipes'],
    ['', '/recipes'],
    ['https://evil.test', '/recipes'],
    ['//evil.test/x', '/recipes'],
    ['/\\evil.test', '/recipes'],
    ['settings', '/recipes'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});

describe('auth guards', () => {
  async function navigate(url: string, email?: string) {
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(new FakeAuthRepository(email)),
        provideRouter([
          { path: 'sign-in', component: Blank, canActivate: [signedOutGuard] },
          {
            path: '',
            canActivateChild: [signedInGuard],
            children: [
              { path: 'recipes', component: Blank },
              { path: 'settings', component: Blank },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it('sends signed-out users to sign-in, remembering where they were going', async () => {
    expect(await navigate('/settings')).toBe('/sign-in?next=%2Fsettings');
  });

  it('lets signed-in users through', async () => {
    expect(await navigate('/settings', 'a@example.test')).toBe('/settings');
  });

  it('sends signed-in users away from sign-in, to where they were going', async () => {
    expect(await navigate('/sign-in?next=%2Fsettings', 'a@example.test')).toBe(
      '/settings',
    );
    TestBed.resetTestingModule();
    expect(
      await navigate('/sign-in?next=%2F%2Fevil.test', 'a@example.test'),
    ).toBe('/recipes');
  });

  it('shows sign-in to signed-out users', async () => {
    expect(await navigate('/sign-in')).toBe('/sign-in');
  });
});
