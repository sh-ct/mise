import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store';

interface FakeMedia {
  matches: boolean;
  listeners: Set<(e: { matches: boolean }) => void>;
  addEventListener(type: string, fn: (e: { matches: boolean }) => void): void;
  removeEventListener(
    type: string,
    fn: (e: { matches: boolean }) => void,
  ): void;
}

function fakeMatchMedia(matches: boolean): FakeMedia {
  return {
    matches,
    listeners: new Set(),
    addEventListener(_type, fn) {
      this.listeners.add(fn);
    },
    removeEventListener(_type, fn) {
      this.listeners.delete(fn);
    },
  };
}

describe('ThemeStore', () => {
  let media: FakeMedia;
  const root = document.documentElement;

  function create() {
    const store = TestBed.inject(ThemeStore);
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    localStorage.clear();
    delete root.dataset['theme'];
    delete root.dataset['mode'];
    document.querySelector('meta[name="theme-color"]')?.remove();
    media = fakeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('defaults to Market Stall following the device theme', () => {
    const store = create();
    expect(store.themeId()).toBe('market-stall');
    expect(store.appearance()).toBe('system');
    expect(root.dataset['theme']).toBe('market-stall');
    expect(root.dataset['mode']).toBe('light');
  });

  it('switches live when the device theme changes', () => {
    const store = create();
    media.listeners.forEach((fn) => fn({ matches: true }));
    TestBed.tick();
    expect(store.mode()).toBe('dark');
    expect(root.dataset['mode']).toBe('dark');
  });

  it('applies and persists explicit choices', () => {
    const store = create();
    store.setTheme('bento');
    store.setAppearance('dark');
    TestBed.tick();
    expect(root.dataset['theme']).toBe('bento');
    expect(root.dataset['mode']).toBe('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '{}')).toEqual(
      { themeId: 'bento', appearance: 'dark' },
    );
  });

  it('restores saved choices and replaces unknown values with defaults', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ themeId: 'enamel', appearance: 'sepia' }),
    );
    const store = create();
    expect(store.themeId()).toBe('enamel');
    expect(store.appearance()).toBe('system');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '{}')).toEqual(
      { themeId: 'enamel', appearance: 'system' },
    );
  });

  it('survives corrupt storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{not json');
    expect(create().themeId()).toBe('market-stall');
  });

  it('turns dark at 19:00 in time mode, via the minute clock or on returning to the app', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 8, 30, 18, 59, 30));
    const store = create();
    store.setAppearance('time');
    TestBed.tick();
    expect(store.mode()).toBe('light');

    vi.advanceTimersByTime(60_000);
    TestBed.tick();
    expect(store.mode()).toBe('dark');

    vi.setSystemTime(new Date(2026, 9, 1, 7, 30));
    document.dispatchEvent(new Event('visibilitychange'));
    TestBed.tick();
    expect(store.mode()).toBe('light');
  });

  it('keeps the browser theme colour in step with the canvas token', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    root.style.setProperty('--ds-canvas', '#123456');
    create();
    expect(meta.getAttribute('content')).toBe('#123456');
    root.style.removeProperty('--ds-canvas');
  });

  it('stops listening when destroyed', () => {
    create();
    expect(media.listeners.size).toBe(1);
    TestBed.resetTestingModule();
    expect(media.listeners.size).toBe(0);
  });
});
