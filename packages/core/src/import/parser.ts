import {
  allIngredients,
  allSteps,
  type RecipeDraft,
} from '../schema/recipe.ts';
import { htmlToText, removeElements } from './html.ts';
import { importRecipeFromHtml } from './jsonld.ts';
import { hasIngredientsHeading, parseRecipeText } from './text.ts';

export type RecipeInput =
  | { kind: 'html'; html: string; url?: string }
  | { kind: 'text'; text: string }
  | { kind: 'ocr'; text: string };

/**
 * Any source of recipes: heuristic parsers now, AI providers later (ADR 0004). Every parser returns a
 * draft that the user reviews in the editor; nothing is saved directly.
 */
export interface RecipeParser {
  readonly name: string;
  canParse(input: RecipeInput): boolean;
  parse(input: RecipeInput): Promise<RecipeDraft | undefined>;
}

/**
 * Recipe web pages: schema.org JSON-LD when the page has it (most recipe sites), otherwise the page's
 * main text through the plain-text splitter. The fallback is noisy by nature; the editor review is
 * what makes it usable. A page counts as a recipe only with an "Ingredients" heading plus ingredients and
 * steps: without that structure, any page of short lines and sentences would read as a recipe.
 */
export const htmlParser: RecipeParser = {
  name: 'html',
  canParse: (input) => input.kind === 'html',
  parse: async (input) => {
    if (input.kind !== 'html') return undefined;
    const fromJsonLd = importRecipeFromHtml(
      input.html,
      input.url ? { sourceUrl: input.url } : {},
    );
    if (fromJsonLd) return fromJsonLd;
    const text = htmlToText(mainContent(input.html));
    if (!hasIngredientsHeading(text)) return undefined;
    const draft = parseRecipeText(text, {
      sourceType: 'url',
      ...(input.url && { sourceUrl: input.url }),
    });
    return allIngredients(draft).length > 0 && allSteps(draft).length > 0
      ? draft
      : undefined;
  },
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

/** The page's <article> or <main> if it has one, without scripts, styles and navigation. */
function mainContent(html: string): string {
  const lower = html.toLowerCase();
  for (const tag of ['article', 'main']) {
    const start = lower.indexOf(`<${tag}`);
    const end = lower.lastIndexOf(`</${tag}>`);
    if (start >= 0 && end > start) {
      return removeElements(html.slice(start, end), [
        'script',
        'style',
        'nav',
        'aside',
        'form',
        'noscript',
      ]);
    }
  }
  return removeElements(html, [
    'head',
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'noscript',
  ]);
}
