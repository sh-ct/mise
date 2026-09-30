# ADR 0007 — Design tokens and swappable themes

**Status:** Accepted · 2026-09-30

## Context

Five visual directions were explored (`docs/design/style-directions.html`), each with a light and dark theme.
Market Stall is the starting choice, but the others should stay available, and switching later should be cheap.

## Decision

- **Three layers.** Theme files (`apps/web/src/styles/themes/*.css`) hold every literal value as `--ds-*` custom
  properties for one theme in light and dark mode. `styles/tokens.css` maps them into Tailwind's theme and adds
  a few token utilities (`heading`, `step-text`, `tag`, `card-edge`, `nums`). Components use only those.
- **Tailwind's defaults are removed** (`--color-*: initial` etc.), so palette utilities like `bg-red-500` don't
  exist; only token utilities do.
- **Theme character is tokens too**: tag tilt, heading case and tracking, card border width, the top rule,
  variable-font axes. A new visual need becomes a new token defined by every theme, never a one-off value.
- **Selection** is `data-theme` and `data-mode` on `<html>`, set by `ThemeStore` (NgRx SignalStore) from the user's
  choice: a theme, plus appearance = light / dark / time of day / device. A pre-boot script in `index.html`
  applies the saved choice before first paint.
- **spartan/ui** reads shadcn-style variables (`--primary`, `--background`, …); `tokens.css` aliases them to our
  tokens so generated components follow the theme unchanged.
- **Enforcement**: `tools/check-tokens.mjs` (`nx run web:tokens`, in CI) fails on literal colours, colour
  functions, arbitrary Tailwind colour/font/radius values and literal font families in `src/app`. UI PRs also
  get a review focused on style consistency, token rules and UX.

## Consequences

- Switching the default theme is a one-line change; adding a theme is one CSS file plus a registry entry.
- Fonts load per theme from Google Fonts at runtime; self-hosting them for offline use is part of the PWA work.
- Components can't reach for a quick literal colour; that friction is intended.
