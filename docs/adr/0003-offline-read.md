# ADR 0003 — Read-only offline, not offline-first

**Status:** Accepted · 2026-09-29

## Context

The main offline need is a kitchen with poor Wi-Fi: reading a recipe you're about to cook.
Full offline-first editing would need sync and conflict resolution.

## Decision

- Angular service worker caches the app shell, assets and images (size-capped).
- Recipe data is cached in IndexedDB (Dexie) for recently opened and explicitly **pinned** recipes.
- Cook-mode progress is persisted locally.
- Editing is disabled offline with a clear banner.

## Consequences

- Much simpler than a sync engine. Can move to offline-first later (e.g. a sync layer such as
  PowerSync or ElectricSQL) behind the same repository interfaces if needed.
