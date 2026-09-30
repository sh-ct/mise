import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import {
  FakeAuthRepository,
  fakeSession,
  provideFakeAuth,
} from '../../testing/fake-auth';
import { APP_NAME } from '../app-name';
import { Shell } from './shell';

@Component({ template: '' })
class Blank {}

describe('Shell', () => {
  let repository: FakeAuthRepository;
  let versionUpdates: Subject<VersionEvent>;

  async function render() {
    repository = new FakeAuthRepository('cook@example.test');
    versionUpdates = new Subject<VersionEvent>();
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(repository),
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates,
            unrecoverable: new Subject(),
            checkForUpdate: async () => false,
          },
        },
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

  it('offers a reload once a new version is ready', async () => {
    const { harness, el } = await render();
    expect(el.querySelector('[role="status"]')).toBeNull();
    versionUpdates.next({ type: 'VERSION_READY' } as VersionEvent);
    await harness.fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      `A new version of ${APP_NAME} is ready.`,
    );
  });
});
