import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FakeAuthRepository, provideFakeAuth } from '../../testing/fake-auth';
import { APP_NAME } from '../app-name';
import { Shell } from './shell';

@Component({ template: '' })
class Blank {}

describe('Shell', () => {
  let repository: FakeAuthRepository;

  async function render() {
    repository = new FakeAuthRepository('cook@example.test');
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(repository),
        provideRouter([
          { path: 'sign-in', component: Blank },
          {
            path: '',
            component: Shell,
            children: [{ path: 'recipes', component: Blank }],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/recipes');
    return { harness, el: harness.fixture.nativeElement as HTMLElement };
  }

  it('renders the app name, a skip link and both navigation landmarks', async () => {
    const { el } = await render();
    expect(el.textContent).toContain(APP_NAME);
    expect(el.querySelector('a[href="#main"]')?.textContent).toContain(
      'Skip to content',
    );
    // Sidebar (desktop) and tab bar (phones, tablets); CSS shows one at a time.
    expect(el.querySelectorAll('nav[aria-label="Main"]')).toHaveLength(2);
  });

  it('goes to sign-in when the session ends', async () => {
    const { harness } = await render();
    repository.setSession(null);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/sign-in');
  });
});
