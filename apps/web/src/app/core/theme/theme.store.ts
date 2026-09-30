import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, signal } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  DEFAULT_APPEARANCE,
  isAppearance,
  resolveMode,
  type Appearance,
} from './appearance';
import { DEFAULT_THEME, isThemeId, type ThemeId } from './themes';

/** localStorage key; also read by public/theme-boot.js, so keep them in sync. */
export const THEME_STORAGE_KEY = 'theme-preferences';

interface ThemeState {
  themeId: ThemeId;
  appearance: Appearance;
}

function safeStorage(win: Window | null): Storage | undefined {
  try {
    return win?.localStorage ?? undefined;
  } catch {
    return undefined; // site data blocked
  }
}

function loadState(storage: Storage | undefined): ThemeState {
  try {
    const saved: unknown = JSON.parse(
      storage?.getItem(THEME_STORAGE_KEY) ?? '{}',
    );
    const s = (saved && typeof saved === 'object' ? saved : {}) as Record<
      string,
      unknown
    >;
    return {
      themeId: isThemeId(s['themeId']) ? s['themeId'] : DEFAULT_THEME,
      appearance: isAppearance(s['appearance'])
        ? s['appearance']
        : DEFAULT_APPEARANCE,
    };
  } catch {
    return { themeId: DEFAULT_THEME, appearance: DEFAULT_APPEARANCE };
  }
}

/**
 * The visual theme and light/dark appearance. Applies `data-theme` and `data-mode` to <html>, keeps the
 * browser's theme colour in step, and persists the choice. Time-based appearance is re-checked every
 * minute and whenever the app comes back to the foreground; device-based follows `prefers-color-scheme`.
 */
export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withProps(() => {
    const document = inject(DOCUMENT);
    const media = document.defaultView?.matchMedia?.(
      '(prefers-color-scheme: dark)',
    );
    return {
      _document: document,
      _storage: safeStorage(document.defaultView),
      _media: media,
      _systemPrefersDark: signal(media?.matches ?? false),
      _now: signal(new Date()),
    };
  }),
  withState<ThemeState>({
    themeId: DEFAULT_THEME,
    appearance: DEFAULT_APPEARANCE,
  }),
  withComputed(({ appearance, _now, _systemPrefersDark }) => ({
    mode: computed(() =>
      resolveMode(appearance(), _now(), _systemPrefersDark()),
    ),
  })),
  withMethods((store) => ({
    setTheme(themeId: ThemeId): void {
      patchState(store, { themeId });
    },
    setAppearance(appearance: Appearance): void {
      patchState(store, { appearance });
    },
  })),
  withHooks((store) => {
    const onSystemChange = (e: MediaQueryListEvent) =>
      store._systemPrefersDark.set(e.matches);
    const tick = () => store._now.set(new Date());
    const onVisible = () => {
      if (store._document.visibilityState === 'visible') tick();
    };
    let clock: ReturnType<typeof setInterval> | undefined;

    return {
      onInit() {
        patchState(store, loadState(store._storage));
        store._media?.addEventListener?.('change', onSystemChange);
        store._document.addEventListener('visibilitychange', onVisible);
        clock = setInterval(tick, 60_000);

        const doc = store._document;
        effect(() => {
          const root = doc.documentElement;
          root.dataset['theme'] = store.themeId();
          root.dataset['mode'] = store.mode();
          const canvas = doc.defaultView
            ?.getComputedStyle(root)
            .getPropertyValue('--ds-canvas')
            .trim();
          if (canvas)
            doc
              .querySelector('meta[name="theme-color"]')
              ?.setAttribute('content', canvas);
        });

        effect(() => {
          const state: ThemeState = {
            themeId: store.themeId(),
            appearance: store.appearance(),
          };
          try {
            store._storage?.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
          } catch {
            // storage full or blocked: the choice still applies for this session
          }
        });
      },
      onDestroy() {
        store._media?.removeEventListener?.('change', onSystemChange);
        store._document.removeEventListener('visibilitychange', onVisible);
        clearInterval(clock);
      },
    };
  }),
);
