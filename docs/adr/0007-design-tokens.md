# ADR 0007 — Design tokens and swappable themes

**Status:** Accepted · 2026-09-30

## Context

Five visual directions were explored (`docs/design/style-directions.html`), each with a light and dark theme.
Market Stall is the starting choice, but the others should stay available, and switching later should be cheap.

## Decision

- **Three layers.** Theme files (`apps/web/src/styles/themes/*.css`) hold every literal value as `--ds-*` custom
  properties for one theme in light and dark mode. `styles/tokens.css` maps them into Tailwind's theme and adds
  a few token utilities (`heading`, `step-text`, `tag`, `card-edge`, `nums`, `choice`, `btn`, `field`). Components
  use only those.
- **Tailwind's defaults are removed** (`--color-*: initial` etc.), so palette utilities like `bg-red-500` don't
  exist; only token utilities do.
- **Theme character is tokens too**: tag tilt, heading case and tracking, card border width, the top rule,
  variable-font axes. A new visual need becomes a new token defined by every theme, never a one-off value.
- **Selection** is `data-theme` and `data-mode` on `<html>`, set by `ThemeStore` (NgRx SignalStore) from the user's
  choice: a theme, plus appearance = light / dark / time of day / device. `public/theme-boot.js` (a blocking
  script, so a strict CSP needs no inline-script exception) applies the saved choice before first paint.
- **Theme blocks use `[data-theme='…']`**, not `:root`, and shared defaults sit on `[data-theme]`, so any element
  can render another theme; Settings shows a live sample of each.
- **Fonts are self-hosted** (Fontsource packages): no requests to third parties, and they work offline.
- **spartan/ui** reads shadcn-style variables (`--primary`, `--background`, …); `tokens.css` aliases them to our
  tokens so generated components follow the theme unchanged.
- **Enforcement**: `tools/check-tokens.mjs` (`pnpm tokens`, in CI) fails on literal colours, shadows and font
  families, arbitrary Tailwind values containing colours, and Tailwind's removed default palette, radii, shadows
  and fonts in `src/app`. A unit test checks every registered theme defines the contract in both modes. UI PRs
  also get a review focused on style consistency, token rules and UX.

## Consequences

- Switching the default theme is a one-line change; adding a theme is one CSS file plus a registry entry.
- Components can't reach for a quick literal colour; that friction is intended.
