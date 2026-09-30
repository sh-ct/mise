import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { appRoutes } from './app.routes';
import { AppUpdateStore } from './core/pwa/app-update.store';
import { ThemeStore } from './core/theme/theme.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    // Stores started at boot: the saved theme applies on every route, and no app update event is missed
    // before the signed-in shell loads.
    provideAppInitializer(() => {
      inject(ThemeStore);
      inject(AppUpdateStore);
    }),
    // Production builds only (ngsw-config.json).
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() }),
  ],
};
