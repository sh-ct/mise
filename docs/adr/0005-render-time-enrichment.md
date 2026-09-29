# ADR 0005 — Timers and glossary detected at render time, not marked up

**Status:** Accepted · 2026-09-29 · Supersedes the inline-token part of ADR 0002

## Context

We considered inline markup in step text (`[[fold]]`, `{{timer:25m}}`). But the glossary is curated by us and
should apply to every recipe — including ones written before a term existed — and durations in recipe prose
follow predictable patterns.

## Decision

- Step text is stored as plain prose.
- `packages/core/steps` detects durations and glossary terms when rendering.
- Glossary terms have `aliases` and `match_rules` (`requireNear` / `excludeNear`) to handle ambiguous words;
  steps have a `glossary_suppress` list for per-step false positives. First mention per step is underlined.
- Duration ranges start a timer at the lower bound with a "check now" prompt; timers can be extended after expiry.

## Consequences

- Adding a glossary term enriches all recipes instantly; no migrations or re-imports.
- Detection is pure, deterministic and heavily unit-testable against the recipe corpus.
- False positives are possible; mitigated by match rules and suppression. If detection proves too weak,
  an explicit override field can be added per step without changing the prose format.
