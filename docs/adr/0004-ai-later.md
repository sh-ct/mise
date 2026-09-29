# ADR 0004 — Non-AI first; AI behind a pluggable interface

**Status:** Accepted · 2026-09-29

## Context

Photo and free-text parsing and a conversational cook assistant would benefit from an LLM, but the
budget is $0 initially.

## Decision

- Ship heuristic parsers first (JSON-LD, ingredient-line parser, text splitter, Tesseract.js OCR).
- Define a `RecipeParser` interface in `packages/core` returning `RecipeDraft`; AI providers are later implementations.
- AI order: free tier → paid (server-side key in an edge function) and/or bring-your-own-key.
- Voice without AI uses the Web Speech API; the AI assistant later reuses the same cook-mode actions.

## Consequences

- Heuristic parsers double as a fallback and a baseline to measure AI parsing against, using the shared test corpus.
