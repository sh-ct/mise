import { importRecipeFromHtml } from './jsonld';
import { parseRecipeText } from './text';
import type { RecipeDraft } from '../schema/recipe';

/**
 * Any source of recipes: heuristic parsers now, AI providers later (ADR 0004). Every parser returns a
 * draft that the user reviews in the editor; nothing is saved directly.
 */
export type RecipeInput =
  | { kind: 'html'; html: string; url?: string }
  | { kind: 'text'; text: string }
  | { kind: 'ocr'; text: string };

export interface RecipeParser {
  readonly name: string;
  canParse(input: RecipeInput): boolean;
  parse(input: RecipeInput): Promise<RecipeDraft | undefined>;
}

/** schema.org JSON-LD embedded in a recipe page — most recipe sites publish it. */
export const jsonLdParser: RecipeParser = {
  name: 'json-ld',
  canParse: (input) => input.kind === 'html',
  parse: async (input) =>
    input.kind === 'html'
      ? importRecipeFromHtml(
          input.html,
          input.url ? { sourceUrl: input.url } : {},
        )
      : undefined,
};

/** Heuristic splitter for pasted text and OCR output. */
export const plainTextParser: RecipeParser = {
  name: 'plain-text',
  canParse: (input) => input.kind === 'text' || input.kind === 'ocr',
  parse: async (input) =>
    input.kind === 'html'
      ? undefined
      : parseRecipeText(input.text, {
          sourceType: input.kind === 'ocr' ? 'scan' : 'text',
        }),
};
