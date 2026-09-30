import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A 24×24 stroked line icon drawn with the current text colour; size it with Tailwind (`size-5`). */
@Component({
  selector: 'mise-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" class="size-full fill-none stroke-current">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    svg {
      stroke-width: var(--ds-icon-stroke);
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class Icon {
  /** SVG path data. */
  readonly path = input.required<string>();
}

export const ICONS = {
  recipes:
    'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4z',
} as const;
