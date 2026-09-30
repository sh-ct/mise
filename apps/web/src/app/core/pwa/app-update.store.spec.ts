import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
  FakeSwUpdate,
  provideFakeSwUpdate,
} from '../../../testing/fake-sw-update';
import { AppUpdateStore, CHECK_INTERVAL_MS } from './app-update.store';

describe('AppUpdateStore', () => {
  let fakeDocument: {
    location: { reload: ReturnType<typeof vi.fn> };
    visibilityState: DocumentVisibilityState;
    defaultView: { sessionStorage: Storage };
    addEventListener: Document['addEventListener'];
    removeEventListener: Document['removeEventListener'];
  };

  function setup(isEnabled = true) {
    const updates = new FakeSwUpdate(isEnabled);
    // Only what the store uses; events still go through the real document.
    fakeDocument = {
      location: { reload: vi.fn() },
      visibilityState: 'visible',
      defaultView: { sessionStorage },
      addEventListener: document.addEventListener.bind(document),
      removeEventListener: document.removeEventListener.bind(document),
    };
    TestBed.configureTestingModule({
      providers: [
        provideFakeSwUpdate(updates),
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    return { updates, store: TestBed.inject(AppUpdateStore) };
  }

  const foreground = () =>
    document.dispatchEvent(new Event('visibilitychange'));

  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('offers an update only once the new version is downloaded', () => {
    const { updates, store } = setup();
    updates.versionUpdates.next({ type: 'VERSION_DETECTED' } as never);
    expect(store.offer()).toBe(false);
    updates.versionReady();
    expect(store.offer()).toBe(true);
  });

  it('can be put off until the next launch', () => {
    const { updates, store } = setup();
    updates.versionReady();
    store.later();
    expect(store.offer()).toBe(false);
  });

  it('reloads once when the cached version cannot recover, then offers instead', () => {
    const { updates, store } = setup();
    updates.unrecoverable.next({});
    expect(fakeDocument.location.reload).toHaveBeenCalledTimes(1);

    updates.unrecoverable.next({});
    expect(fakeDocument.location.reload).toHaveBeenCalledTimes(1);
    expect(store.offer()).toBe(true);
  });

  it('checks when the app comes back to the foreground, at most every ten minutes', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { updates } = setup();
    foreground();
    expect(updates.checkForUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    foreground();
    foreground();
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not check while hidden, and shrugs off a failed check', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { updates } = setup();
    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    fakeDocument.visibilityState = 'hidden';
    foreground();
    expect(updates.checkForUpdate).not.toHaveBeenCalled();

    fakeDocument.visibilityState = 'visible';
    updates.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    foreground();
    await Promise.resolve();
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a service worker (development, unsupported browsers)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { updates, store } = setup(false);
    updates.versionReady();
    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    foreground();
    expect(store.offer()).toBe(false);
    expect(updates.checkForUpdate).not.toHaveBeenCalled();
  });
});
