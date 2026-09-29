# ADR 0002 — Structured ingredients and explicit step↔ingredient links

**Status:** Accepted · 2026-09-29

## Context

Cook mode shows the next step with the ingredients and amounts it needs; scaling, unit conversion and a
future shopping list all need numeric quantities. Imports are messy and parsing will be imperfect.

## Decision

- Ingredients stored as `qty_min / qty_max / unit / item / prep_note / optional`, **plus `raw_text`** always.
- Steps link to ingredients via a `step_ingredient` join table (with `amount_fraction` for "half the butter"),
  not inline text references.
- Step text is plain prose; timers and glossary terms are detected at render time ([ADR 0005](0005-render-time-enrichment.md)).
- Imports auto-link by fuzzy-matching ingredient items in step text; the editor allows correction.

## Consequences

- Editor is more complex (link UI), but every downstream feature works from data, not regex at render time.
- `raw_text` means a bad parse never loses information and can be re-parsed later (e.g. by AI).
