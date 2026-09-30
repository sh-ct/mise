import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { APP_NAME } from './app-name';

describe('App', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the app name and both navigation landmarks', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(APP_NAME);
    // Sidebar (tablet/desktop) and tab bar (phone); CSS shows one at a time.
    expect(el.querySelectorAll('nav[aria-label="Main"]')).toHaveLength(2);
  });

  it('applies the theme to the document on start', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(document.documentElement.dataset['theme']).toBe('market-stall');
  });
});
