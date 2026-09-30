import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { filter } from 'rxjs';

/**
 * New app versions from the service worker. The worker downloads a new version in the background; `ready`
 * says it's waiting, and the user chooses when to reload (never mid-task). An installed app can stay open for
 * days, so it also checks whenever it comes back to the foreground.
 */
export const AppUpdateStore = signalStore(
  { providedIn: 'root' },
  withState({ ready: false }),
  withProps(() => ({
    _updates: inject(SwUpdate),
    _document: inject(DOCUMENT),
  })),
  withMethods(({ _document }) => ({
    reload: () => _document.location.reload(),
  })),
  withHooks((store) => {
    const onVisible = () => {
      if (store._document.visibilityState === 'visible')
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
        // The cached version is broken beyond repair (e.g. evicted files): only a reload recovers.
        store._updates.unrecoverable
          .pipe(takeUntilDestroyed())
          .subscribe(() => store.reload());
        store._document.addEventListener('visibilitychange', onVisible);
      },
      onDestroy() {
        store._document.removeEventListener('visibilitychange', onVisible);
      },
    };
  }),
);
