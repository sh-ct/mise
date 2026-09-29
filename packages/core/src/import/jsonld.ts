import type { IdFactory } from '../ids';
import type { RecipeDraft } from '../schema/recipe';
import { buildDraft, type RawRecipe, type RawSection } from './draft-builder';
import { cleanLine, htmlToText } from './html';
import { isoDurationToMinutes } from './iso-duration';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: Json | undefined): Json[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
const str = (v: Json | undefined): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;

function hasType(node: JsonObject, type: string): boolean {
  return asArray(node['@type']).some(
    (t) =>
      typeof t === 'string' &&
      (t === type || t.endsWith(`/${type}`) || t.endsWith(`:${type}`)),
  );
}

/** Parse every `<script type="application/ld+json">` block in a page. Invalid blocks are skipped. */
export function extractJsonLd(html: string): Json[] {
  const blocks: Json[] = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const body = (m[1] ?? '')
      .trim()
      .replace(/^<!--|-->$/g, '')
      .replace(/^\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/$/g, '')
      .trim();
    try {
      blocks.push(JSON.parse(body) as Json);
    } catch {
      // Some sites ship broken JSON-LD (raw control characters in strings); retry with them as spaces.
      try {
        // eslint-disable-next-line no-control-regex
        blocks.push(JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' ')) as Json);
      } catch {
        /* skip */
      }
    }
  }
  return blocks;
}

/** Find schema.org Recipe nodes anywhere in parsed JSON-LD (arrays, @graph, mainEntity, nesting). */
export function findRecipeNodes(data: Json | Json[]): JsonObject[] {
  const found: JsonObject[] = [];
  const seen = new Set<unknown>();
  const visit = (v: Json | undefined, depth: number) => {
    if (depth > 8 || v === undefined || v === null || seen.has(v)) return;
    if (typeof v === 'object') seen.add(v);
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1));
    if (!isObject(v)) return;
    if (hasType(v, 'Recipe')) {
      found.push(v);
      return;
    }
    for (const key of [
      '@graph',
      'mainEntity',
      'mainEntityOfPage',
      'itemListElement',
      'item',
      'hasPart',
    ])
      visit(v[key], depth + 1);
  };
  visit(data as Json, 0);
  return found;
}

function textOf(v: Json | undefined): string | undefined {
  if (typeof v === 'string') return v;
  if (isObject(v))
    return str(v['text']) ?? str(v['name']) ?? str(v['description']);
  return undefined;
}

/** Instructions come as a string, strings, HowToStep(s) or HowToSection(s) — normalise to sections of lines. */
function instructionSections(value: Json | undefined): RawSection[] {
  const loose: string[] = [];
  const sections: RawSection[] = [];

  const splitBlob = (blob: string): string[] =>
    htmlToText(blob)
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+(?=(?:step\s*)?\d+[.)]\s)/i))
      .map((l) => l.replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, '').trim())
      .filter(Boolean);

  const stepLines = (item: Json): string[] => {
    if (typeof item === 'string') return splitBlob(item);
    if (!isObject(item)) return [];
    // HowToStep may itself contain HowToDirection / HowToTip items.
    if (
      item['itemListElement'] !== undefined &&
      !hasType(item, 'HowToSection')
    ) {
      const inner = asArray(item['itemListElement'])
        .map((x) => textOf(x))
        .filter((x): x is string => !!x);
      if (inner.length) return [cleanLine(inner.join(' '))];
    }
    const t = textOf(item);
    return t ? splitBlob(t) : [];
  };

  for (const item of asArray(value)) {
    if (isObject(item) && hasType(item, 'HowToSection')) {
      sections.push({
        ...(str(item['name']) && { title: cleanLine(str(item['name']) ?? '') }),
        lines: asArray(item['itemListElement']).flatMap(stepLines),
      });
    } else {
      loose.push(...stepLines(item));
    }
  }
  return loose.length ? [{ lines: loose }, ...sections] : sections;
}

/** recipeIngredient is a flat list; some sites embed sub-headings like "For the sauce:" in it. */
function ingredientSections(value: Json | undefined): RawSection[] {
  const sections: RawSection[] = [{ lines: [] }];
  for (const v of asArray(value)) {
    const line = str(v) ?? textOf(v);
    if (!line) continue;
    const text = cleanLine(line);
    if (!text) continue;
    const heading =
      /^(?:for the\s+)?[^\d½¼¾⅓⅔].{0,40}:$/i.test(text) && !/\d/.test(text);
    if (heading) sections.push({ title: text.replace(/:$/, ''), lines: [] });
    else sections[sections.length - 1]?.lines.push(text);
  }
  return sections;
}

function firstUrl(v: Json | undefined): string | undefined {
  for (const item of asArray(v)) {
    if (typeof item === 'string') return item;
    if (isObject(item)) {
      const url =
        str(item['url']) ?? str(item['contentUrl']) ?? str(item['@id']);
      if (url) return url;
    }
  }
  return undefined;
}

function names(v: Json | undefined): string[] {
  return asArray(v)
    .map((x) =>
      typeof x === 'string' ? x : isObject(x) ? str(x['name']) : undefined,
    )
    .filter((x): x is string => !!x)
    .map(cleanLine);
}

function yieldInfo(v: Json | undefined): {
  servings?: number;
  yieldText?: string;
} {
  const values = asArray(v)
    .map((x) => str(x))
    .filter((x): x is string => !!x)
    .map(cleanLine);
  const n = values.map((s) => /\d+/.exec(s)?.[0]).find((x) => x !== undefined);
  const text = values
    .filter((s) => !/^\d+$/.test(s))
    .sort((a, b) => b.length - a.length)[0];
  return {
    ...(n !== undefined && { servings: Number(n) }),
    ...(text && { yieldText: text }),
  };
}

function tagList(node: JsonObject): string[] {
  const split = (v: Json | undefined) =>
    asArray(v)
      .flatMap((x) => (typeof x === 'string' ? x.split(',') : []))
      .map((t) => cleanLine(t))
      .filter((t) => t && t.length <= 40);
  return [
    ...split(node['recipeCuisine']),
    ...split(node['recipeCategory']),
    ...split(node['keywords']),
  ];
}

export interface ImportOptions {
  sourceUrl?: string;
  idFactory?: IdFactory;
}

/** Convert one schema.org Recipe node into a draft for review. */
export function recipeFromJsonLd(
  node: JsonObject,
  options: ImportOptions = {},
): RecipeDraft {
  const raw: RawRecipe = {
    sourceType: 'url',
    title: cleanLine(str(node['name']) ?? str(node['headline']) ?? ''),
    description: htmlToText(str(node['description']) ?? ''),
    ...yieldInfo(node['recipeYield'] ?? node['yield']),
    prepMinutes: isoDurationToMinutes(node['prepTime']),
    cookMinutes: isoDurationToMinutes(node['cookTime']),
    totalMinutes: isoDurationToMinutes(node['totalTime']),
    sourceUrl: options.sourceUrl ?? str(node['url']),
    sourceAttribution:
      names(node['author']).join(', ') ||
      names(node['publisher']).join(', ') ||
      undefined,
    heroImageUrl: firstUrl(node['image']),
    tags: tagList(node),
    ingredientSections: ingredientSections(
      node['recipeIngredient'] ?? node['ingredients'],
    ),
    stepSections: instructionSections(node['recipeInstructions']),
  };
  return buildDraft(raw, options.idFactory);
}

/** Import the first recipe found in a page's JSON-LD, or undefined if there is none. */
export function importRecipeFromHtml(
  html: string,
  options: ImportOptions = {},
): RecipeDraft | undefined {
  const node = findRecipeNodes(extractJsonLd(html))[0];
  return node ? recipeFromJsonLd(node, options) : undefined;
}
