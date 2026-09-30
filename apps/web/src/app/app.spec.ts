import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { APP_NAME } from './app-name';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the app name, a skip link and both navigation landmarks', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(APP_NAME);
    expect(el.querySelector('a[href="#main"]')?.textContent).toContain(
      'Skip to content',
    );
    // Sidebar (desktop) and tab bar (phones, tablets); CSS shows one at a time.
    expect(el.querySelectorAll('nav[aria-label="Main"]')).toHaveLength(2);
  });
});
