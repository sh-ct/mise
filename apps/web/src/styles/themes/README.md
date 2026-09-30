# Themes

Each file defines one theme's design tokens for light and dark mode. Together with `_base.css` these are the
only files with literal colours, font names, radii, shadows and layout sizes (enforced by `pnpm tokens`).

```css
[data-theme='<id>'] {
  /* light */
}
[data-theme='<id>'][data-mode='dark'] {
  /* dark: override what changes */
}
```

Blocks use `[data-theme]`, not `:root`, so any element can render another theme (the style previews in
Settings do this). `<html>` carries the active theme and mode, set by `ThemeStore` (`app/core/theme`) and, before
first paint, by `public/theme-boot.js`.

To add a theme: create `<id>.css`, import it in `src/styles.css`, and register the id and label in
`app/core/theme/themes.ts` and `public/theme-boot.js` (a unit test keeps them in sync and checks the contract).

The design directions these come from are in `docs/design/style-directions.html`.

## What a theme must set

In **both** light and dark blocks, the colour tokens:
`--ds-canvas`, `--ds-surface`, `--ds-ink`, `--ds-ink-muted`, `--ds-line`, `--ds-primary`, `--ds-on-primary`,
`--ds-accent` / `--ds-on-accent` (timers, and only timers), `--ds-chip`, `--ds-on-chip`, `--ds-gloss`,
`--ds-progress`, `--ds-tray-a`, `--ds-tray-b`, `--ds-on-tray-b`, `--ds-danger`, `--ds-focus`.

In the light block, the type tokens: `--ds-font-display`, `--ds-font-body`, `--ds-font-num`, `--ds-font-step`,
`--ds-display-weight`, `--ds-step-size`.

## Defaults a theme may override (`_base.css`)

| Group               | Tokens                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Borders and states  | `--ds-card-border-width`, `--ds-card-border`, `--ds-rule-width` / `--ds-rule` (top rule; defaults to the card border), `--ds-control-border` (inputs and choices, ≥ 3:1), `--ds-selected-bg` / `--ds-selected-ink` / `--ds-selected-border`, `--ds-focus-width`, `--ds-focus-offset`, `--ds-disabled-opacity`, `--ds-scrim`, `--ds-on-tray-a`, `--ds-on-danger`, `--ds-color-scheme` |
| Type                | `--ds-heading-transform`, `--ds-heading-tracking`, `--ds-step-weight`, `--ds-step-leading`, `--ds-font-step-settings`, `--ds-font-num-settings` (variable-font axes), `--ds-icon-stroke`, `--ds-title-size`, `--ds-title-size-wide`                                                                                                                                                  |
| Shape               | `--ds-radius-chip`, `--ds-radius-control`, `--ds-radius-card`, `--ds-radius-sheet`, `--ds-radius-thumb`                                                                                                                                                                                                                                                                              |
| Tags                | `--ds-tag-bg`, `--ds-tag-ink`, `--ds-tag-border`, `--ds-tag-border-width`, `--ds-tag-rotate`, `--ds-tag-alt-bg`, `--ds-tag-alt-ink`                                                                                                                                                                                                                                                  |
| Depth               | `--ds-shadow-card`, `--ds-shadow-sheet`                                                                                                                                                                                                                                                                                                                                              |
| Layout and layering | `--ds-sidebar-width`, `--ds-tabbar-height`, `--ds-z-bar`, `--ds-z-scrim`, `--ds-z-sheet`                                                                                                                                                                                                                                                                                             |
| Motion              | `--ds-duration`, `--ds-ease`                                                                                                                                                                                                                                                                                                                                                         |

Keep text pairs at 4.5:1 or better and UI boundaries (control borders, focus) at 3:1.
