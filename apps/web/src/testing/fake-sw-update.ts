import type { Provider } from '@angular/core';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

/** Stands in for the service worker's SwUpdate in unit tests; push events through the subjects. */
export class FakeSwUpdate {
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<unknown>();
  readonly checkForUpdate = vi.fn<() => Promise<boolean>>(async () => false);

  constructor(readonly isEnabled = true) {}

  versionReady(): void {
    this.versionUpdates.next({ type: 'VERSION_READY' } as VersionEvent);
  }
}

export function provideFakeSwUpdate(updates: FakeSwUpdate): Provider {
  return { provide: SwUpdate, useValue: updates };
}
