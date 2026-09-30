import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateStore } from './app-update.store';

describe('AppUpdateStore', () => {
  function setup(isEnabled = true) {
    const updates = {
      isEnabled,
      versionUpdates: new Subject<VersionEvent>(),
      unrecoverable: new Subject<unknown>(),
      checkForUpdate: vi.fn(async () => true),
    };
    const reload = vi.fn();
    // Only what the store uses; events still go through the real document.
    const fakeDocument = {
      location: { reload },
      visibilityState: 'visible',
      addEventListener: document.addEventListener.bind(document),
      removeEventListener: document.removeEventListener.bind(document),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: updates },
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    return { updates, reload, store: TestBed.inject(AppUpdateStore) };
  }

  it('says an update is ready only once the new version is downloaded', () => {
    const { updates, store } = setup();
    updates.versionUpdates.next({ type: 'VERSION_DETECTED' } as VersionEvent);
    expect(store.ready()).toBe(false);
    updates.versionUpdates.next({ type: 'VERSION_READY' } as VersionEvent);
    expect(store.ready()).toBe(true);
  });

  it('reloads when the cached version cannot recover', () => {
    const { updates, reload } = setup();
    updates.unrecoverable.next({});
    expect(reload).toHaveBeenCalled();
  });

  it('checks for updates when the app comes back to the foreground', () => {
    const { updates } = setup();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(updates.checkForUpdate).toHaveBeenCalled();
  });

  it('does nothing without a service worker (development, unsupported browsers)', () => {
    const { updates, store } = setup(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(updates.checkForUpdate).not.toHaveBeenCalled();
    expect(store.ready()).toBe(false);
  });
});
