import { TestBed } from '@angular/core/testing';
import { ThemeStore } from '../../core/theme/theme.store';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    delete document.documentElement.dataset['mode'];
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render() {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      store: TestBed.inject(ThemeStore),
    };
  }

  it('changes appearance and style from the radio groups', async () => {
    const { fixture, el, store } = await render();
    (
      el.querySelector(
        'input[name="appearance"][value="dark"]',
      ) as HTMLInputElement
    ).click();
    (
      el.querySelector(
        'input[name="theme"][value="night-kitchen"]',
      ) as HTMLInputElement
    ).click();
    await fixture.whenStable();
    expect(store.appearance()).toBe('dark');
    expect(store.themeId()).toBe('night-kitchen');
  });

  it('marks the current choices as checked', async () => {
    const { el } = await render();
    expect(
      (
        el.querySelector(
          'input[name="appearance"][value="system"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        el.querySelector(
          'input[name="theme"][value="market-stall"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('says whether it is light or dark only for the automatic modes', async () => {
    const { fixture, el, store } = await render();
    expect(el.textContent).toContain('Light right now.');
    store.setAppearance('dark');
    await fixture.whenStable();
    expect(el.textContent).not.toContain('right now');
  });

  it('renders each style sample in its own theme and the current mode', async () => {
    const { el } = await render();
    const samples = [...el.querySelectorAll('[data-theme]')].map((s) => [
      s.getAttribute('data-theme'),
      s.getAttribute('data-mode'),
    ]);
    expect(samples).toContainEqual(['bento', 'light']);
    expect(samples).toHaveLength(5);
  });
});
