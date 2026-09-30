import { DOCUMENT } from '@angular/common';
import { computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { filter } from 'rxjs';

/** Foreground checks for a new version are at most this often. */
export const CHECK_INTERVAL_MS = 10 * 60_000;

/** sessionStorage key: set when the app has reloaded to recover from a broken cache. */
const RECOVERED = 'app-update-recovered';

/**
 * New app versions from the service worker. The worker downloads a new version in the background; `offer` says
 * it's waiting, and the user chooses when to update (never mid-task) or puts it off until the next launch. An
 * installed app can stay open for days, so it also checks when it comes back to the foreground. Started at boot,
 * so no event is missed on the signed-out pages.
 */
export const AppUpdateStore = signalStore(
  { providedIn: 'root' },
  withState({ ready: false, dismissed: false }),
  withProps(() => ({
    _updates: inject(SwUpdate),
    _document: inject(DOCUMENT),
  })),
  withComputed(({ ready, dismissed }) => ({
    offer: computed(() => ready() && !dismissed()),
  })),
  withMethods((store) => ({
    reload: () => store._document.location.reload(),
    later: () => patchState(store, { dismissed: true }),
  })),
  withHooks((store) => {
    let lastCheck = Date.now();
    const onVisible = () => {
      if (store._document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      store._updates.checkForUpdate().catch(() => undefined); // offline: try next time
    };
    return {
      onInit() {
        if (!store._updates.isEnabled) return;
        store._updates.versionUpdates
          .pipe(
            filter((event) => event.type === 'VERSION_READY'),
            takeUntilDestroyed(),
          )
          .subscribe(() => patchState(store, { ready: true }));
        // The cached version is broken beyond repair (e.g. evicted files): a reload recovers. Only once per
        // session, so a cache that keeps failing offers the update instead of looping.
        store._updates.unrecoverable
          .pipe(takeUntilDestroyed())
          .subscribe(() => {
            const session = sessionStorageOf(store._document);
            if (session?.getItem(RECOVERED)) {
              patchState(store, { ready: true, dismissed: false });
              return;
            }
            session?.setItem(RECOVERED, '1');
            store.reload();
          });
        store._document.addEventListener('visibilitychange', onVisible);
      },
      onDestroy() {
        store._document.removeEventListener('visibilitychange', onVisible);
      },
    };
  }),
);

function sessionStorageOf(document: Document): Storage | undefined {
  try {
    return document.defaultView?.sessionStorage ?? undefined;
  } catch {
    return undefined; // site data blocked
  }
}
