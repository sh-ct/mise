import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store';

interface FakeMedia {
  matches: boolean;
  listeners: ((e: { matches: boolean }) => void)[];
  addEventListener(type: string, fn: (e: { matches: boolean }) => void): void;
  removeEventListener(): void;
}

function fakeMatchMedia(matches: boolean): FakeMedia {
  return {
    matches,
    listeners: [],
    addEventListener(_type, fn) {
      this.listeners.push(fn);
    },
    removeEventListener() {
      /* not needed */
    },
  };
}

describe('ThemeStore', () => {
  let media: FakeMedia;

  function create() {
    const store = TestBed.inject(ThemeStore);
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    delete document.documentElement.dataset['mode'];
    document.getElementById('theme-fonts')?.remove();
    media = fakeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('defaults to Market Stall following the device theme', () => {
    const store = create();
    expect(store.themeId()).toBe('market-stall');
    expect(store.appearance()).toBe('system');
    expect(document.documentElement.dataset['theme']).toBe('market-stall');
    expect(document.documentElement.dataset['mode']).toBe('light');
  });

  it('switches live when the device theme changes', () => {
    const store = create();
    media.listeners.forEach((fn) => fn({ matches: true }));
    TestBed.tick();
    expect(store.mode()).toBe('dark');
    expect(document.documentElement.dataset['mode']).toBe('dark');
  });

  it('applies and persists explicit choices', () => {
    const store = create();
    store.setTheme('bento');
    store.setAppearance('dark');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('bento');
    expect(document.documentElement.dataset['mode']).toBe('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '{}')).toEqual(
      { themeId: 'bento', appearance: 'dark' },
    );
  });

  it('restores saved choices and ignores unknown values', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ themeId: 'enamel', appearance: 'sepia' }),
    );
    const store = create();
    expect(store.themeId()).toBe('enamel');
    expect(store.appearance()).toBe('system');
  });

  it('survives corrupt storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{not json');
    expect(create().themeId()).toBe('market-stall');
  });

  it('loads the active theme’s fonts once and swaps them on change', () => {
    const store = create();
    const link = document.getElementById('theme-fonts') as HTMLLinkElement;
    expect(link.getAttribute('href')).toContain('Rubik');
    store.setTheme('order-ticket');
    TestBed.tick();
    expect(document.querySelectorAll('#theme-fonts')).toHaveLength(1);
    expect(link.getAttribute('href')).toContain('Barlow');
  });
});
