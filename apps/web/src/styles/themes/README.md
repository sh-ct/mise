# Themes

Each file defines one theme's raw design tokens for light and dark mode. These files are the only place
literal colours, font names, radii and shadows appear in the app (enforced by `pnpm nx run web:tokens`).

```css
:root[data-theme='<id>'] {
  /* light */
}
:root[data-theme='<id>'][data-mode='dark'] {
  /* dark: override what changes */
}
```

The active theme and mode are set on `<html>` by the theme store (`app/core/theme`). Register a new theme in
`app/core/theme/themes.ts` (id, label, font stylesheet) and import its file in `styles.css`.

The design directions these come from are in `docs/design/style-directions.html`.

## Token contract

Every theme defines all of these in light mode; dark mode overrides at least the colours and `--ds-color-scheme`.

| Group  | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colour | `--ds-canvas` page · `--ds-surface` raised areas · `--ds-ink` text · `--ds-ink-muted` secondary text · `--ds-line` borders · `--ds-primary` / `--ds-on-primary` main action · `--ds-accent` / `--ds-on-accent` timers (and only timers) · `--ds-chip` / `--ds-on-chip` chips, running timers · `--ds-gloss` glossary underline · `--ds-progress` progress bar · `--ds-tray-a` / `--ds-on-tray-a`, `--ds-tray-b` / `--ds-on-tray-b` grouped areas (this step's ingredients, next step) · `--ds-danger` / `--ds-on-danger` · `--ds-focus` focus ring · `--ds-rule` top rule colour · `--ds-color-scheme` `light` or `dark` |
| Type   | `--ds-font-display` · `--ds-font-body` · `--ds-font-num` · `--ds-font-step` · `--ds-display-weight` · `--ds-heading-transform` · `--ds-heading-tracking` · `--ds-step-size` · `--ds-step-weight` · `--ds-font-step-settings` · `--ds-font-num-settings` (variable-font axes)                                                                                                                                                                                                                                                                                                                                             |
| Shape  | `--ds-radius-chip` · `--ds-radius-control` · `--ds-radius-card` · `--ds-radius-sheet` · `--ds-radius-thumb` · `--ds-card-border-width` · `--ds-card-border` · `--ds-rule-width`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Tags   | `--ds-tag-bg` · `--ds-tag-ink` · `--ds-tag-border` · `--ds-tag-border-width` · `--ds-tag-rotate` · `--ds-tag-alt-bg` · `--ds-tag-alt-ink`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Depth  | `--ds-shadow-card` · `--ds-shadow-sheet`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
