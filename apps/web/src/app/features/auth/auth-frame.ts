import { Component } from '@angular/core';
import { APP_NAME } from '../../app-name';

/** Layout for the signed-out pages: the app name and one narrow column, centred on larger screens. */
@Component({
  selector: 'mise-auth-frame',
  template: `
    <main
      id="main"
      tabindex="-1"
      class="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 pt-[max(2.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] focus:outline-none"
    >
      <p class="heading text-xl text-ink">{{ appName }}</p>
      <div class="grid gap-5">
        <ng-content />
      </div>
    </main>
  `,
})
export class AuthFrame {
  protected readonly appName = APP_NAME;
}
