import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
  provideFakeAuth,
} from '../../../testing/fake-auth';
import { signedInGuard, signedOutGuard } from './auth.guards';

@Component({ template: '' })
class Blank {}

describe('auth guards', () => {
  function configure(repository: FakeAuthRepository) {
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(repository),
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
  }

  async function navigate(url: string, email?: string) {
    configure(new FakeAuthRepository(email));
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

  it('waits for the saved session before deciding', async () => {
    const repository = new FakeAuthRepository('a@example.test', {
      settled: false,
    });
    configure(repository);
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/settings');
    await Promise.resolve();
    expect(TestBed.inject(Router).url).toBe('/');

    repository.settle();
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/settings');
  });

  it('shows sign-in to signed-out users', async () => {
    expect(await navigate('/sign-in')).toBe('/sign-in');
  });
});
