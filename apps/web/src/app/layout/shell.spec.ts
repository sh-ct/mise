import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAuthRepository,
  fakeSession,
  provideFakeAuth,
} from '../../testing/fake-auth';
import {
  FakeSwUpdate,
  provideFakeSwUpdate,
} from '../../testing/fake-sw-update';
import { APP_NAME } from '../app-name';
import { AppUpdateStore } from '../core/pwa/app-update.store';
import { Shell } from './shell';

@Component({ template: '' })
class Blank {}

describe('Shell', () => {
  let repository: FakeAuthRepository;
  let updates: FakeSwUpdate;

  async function render() {
    repository = new FakeAuthRepository('cook@example.test');
    updates = new FakeSwUpdate();
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(repository),
        provideFakeSwUpdate(updates),
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

  const button = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === text,
    );

  it('renders the app name, a skip link and both navigation landmarks', async () => {
    const { el } = await render();
    expect(el.textContent).toContain(APP_NAME);
    expect(el.querySelector('a[href="#main"]')?.textContent).toContain(
      'Skip to content',
    );
    // Sidebar (desktop) and tab bar (phones, tablets); CSS shows one at a time.
    expect(el.querySelectorAll('nav[aria-label="Main"]')).toHaveLength(2);
  });

  it('goes to sign-in when the session ends, remembering the page', async () => {
    const { harness } = await render();
    repository.setSession(null);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/sign-in?next=%2Frecipes');
  });

  it('stays put when the session is refreshed', async () => {
    const { harness } = await render();
    repository.setSession(fakeSession('cook@example.test'));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/recipes');
  });

  it('offers an update in a status region that is there before it fills', async () => {
    const { harness, el } = await render();
    const status = el.querySelector('[role="status"]');
    expect(status?.textContent?.trim()).toBe('');

    updates.versionReady();
    await harness.fixture.whenStable();
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status?.textContent).toContain(
      `A new version of ${APP_NAME} is ready.`,
    );
  });

  it('updates now, or later', async () => {
    const { harness, el } = await render();
    const store = TestBed.inject(AppUpdateStore);
    const reload = vi
      .spyOn(store, 'reload')
      .mockImplementation(() => undefined);
    updates.versionReady();
    await harness.fixture.whenStable();

    button(el, 'Update now')?.click();
    expect(reload).toHaveBeenCalled();

    button(el, 'Later')?.click();
    await harness.fixture.whenStable();
    expect(button(el, 'Update now')).toBeUndefined();
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });
});
