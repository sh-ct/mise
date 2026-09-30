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
import { DEFAULT_THEME, isThemeId, themeById, type ThemeId } from './themes';

/** localStorage key; also read by the pre-boot script in index.html, so keep them in sync. */
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
 * The visual theme and light/dark appearance. Applies `data-theme` and `data-mode` to <html>, loads the
 * theme's fonts, and persists the choice. Time-based appearance re-checks every minute; device-based
 * follows `prefers-color-scheme` live.
 */
export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<ThemeState>(() =>
    loadState(safeStorage(inject(DOCUMENT).defaultView)),
  ),
  withProps(() => {
    const document = inject(DOCUMENT);
    const media = document.defaultView?.matchMedia?.(
      '(prefers-color-scheme: dark)',
    );
    return {
      _document: document,
      _media: media,
      _systemPrefersDark: signal(media?.matches ?? false),
      _now: signal(new Date()),
    };
  }),
  withComputed(({ appearance, _now, _systemPrefersDark, themeId }) => ({
    mode: computed(() =>
      resolveMode(appearance(), _now(), _systemPrefersDark()),
    ),
    theme: computed(() => themeById(themeId())),
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
    let clock: ReturnType<typeof setInterval> | undefined;

    return {
      onInit() {
        store._media?.addEventListener?.('change', onSystemChange);
        clock = setInterval(() => store._now.set(new Date()), 60_000);

        const doc = store._document;
        effect(() => {
          doc.documentElement.dataset['theme'] = store.themeId();
          doc.documentElement.dataset['mode'] = store.mode();
        });

        effect(() => {
          const href = store.theme().fonts;
          let link = doc.getElementById(
            'theme-fonts',
          ) as HTMLLinkElement | null;
          if (!link) {
            link = doc.createElement('link');
            link.id = 'theme-fonts';
            link.rel = 'stylesheet';
            doc.head.appendChild(link);
          }
          if (link.getAttribute('href') !== href)
            link.setAttribute('href', href);
        });

        effect(() => {
          const state: ThemeState = {
            themeId: store.themeId(),
            appearance: store.appearance(),
          };
          try {
            safeStorage(doc.defaultView)?.setItem(
              THEME_STORAGE_KEY,
              JSON.stringify(state),
            );
          } catch {
            // storage full or blocked: the choice still applies for this session
          }
        });
      },
      onDestroy() {
        store._media?.removeEventListener?.('change', onSystemChange);
        clearInterval(clock);
      },
    };
  }),
);
