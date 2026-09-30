import { Component } from '@angular/core';

/** The recipe library. Until recipes can be added, it explains what will appear here. */
@Component({
  selector: 'mise-library-page',
  template: `
    <h1 class="page-title">Recipes</h1>
    <section
      class="card-edge mt-6 grid gap-4 rounded-card bg-surface p-5 shadow-card md:p-8"
      aria-labelledby="empty-title"
    >
      <h2 id="empty-title" class="heading text-xl">
        Your recipes will live here
      </h2>
      <p class="max-w-prose text-ink-muted">
        Add recipes from a website link, pasted text, a photo of a cookbook
        page, or type your own. Then cook them one step at a time.
      </p>
      <div class="grid gap-2">
        <p class="text-sm font-semibold text-ink-muted">Coming soon</p>
        <ul class="flex flex-wrap gap-2">
          @for (way of ways; track way; let odd = $odd) {
            <li
              class="px-3 py-1 text-sm font-semibold"
              [class.tag]="!odd"
              [class.tag-alt]="odd"
            >
              {{ way }}
            </li>
          }
        </ul>
      </div>
    </section>
  `,
})
export class LibraryPage {
  protected readonly ways = [
    'From a link',
    'Paste text',
    'Scan a page',
    'Type it in',
  ];
}
