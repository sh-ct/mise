import { TestBed } from '@angular/core/testing';
import { ThemeStore } from '../../core/theme/theme.store';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('changes appearance and style from the radio groups', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const store = TestBed.inject(ThemeStore);

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
    expect(el.textContent).toContain('Currently dark.');
  });

  it('marks the current choices as checked', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
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
});
