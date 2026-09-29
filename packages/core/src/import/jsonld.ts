import type { IdFactory } from '../ids';
import type { RecipeDraft } from '../schema/recipe';
import { LIST_NUMBER } from '../text/normalize';
import { buildDraft, type RawRecipe, type RawSection } from './draft-builder';
import { headingTitle, isSectionHeading } from './headings';
import { cleanLine, htmlToText } from './html';
import { isoDurationToMinutes } from './iso-duration';

// WHATWG URL exists in browsers, Deno and Node, but `lib: es2022` has no typings for it.
declare const URL: new (url: string, base?: string) => { href: string };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const MAX_BLOCKS = 50;

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

/**
 * Parse every `<script type="application/ld+json">` block in a page. Invalid blocks are skipped.
 * Scans with indexOf so hostile pages (thousands of unclosed tags) stay linear.
 */
function extractJsonLd(html: string): Json[] {
  const lower = html.toLowerCase();
  const blocks: Json[] = [];
  let pos = 0;
  while (blocks.length < MAX_BLOCKS) {
    const open = lower.indexOf('<script', pos);
    if (open < 0) break;
    const tagEnd = lower.indexOf('>', open);
    if (tagEnd < 0) break;
    const close = lower.indexOf('</script', tagEnd);
    if (close < 0) break;
    pos = close + 8;
    if (
      !/type\s*=\s*["']?application\/ld\+json/.test(lower.slice(open, tagEnd))
    )
      continue;

    const body = html
      .slice(tagEnd + 1, close)
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

/** Walk parsed JSON-LD (arrays, @graph, mainEntity, nesting), depth-limited. */
function walk(data: Json, visit: (node: JsonObject) => boolean | void): void {
  const seen = new Set<unknown>();
  const go = (v: Json | undefined, depth: number) => {
    if (
      depth > 8 ||
      v === undefined ||
      v === null ||
      typeof v !== 'object' ||
      seen.has(v)
    )
      return;
    seen.add(v);
    if (Array.isArray(v)) return v.forEach((x) => go(x, depth + 1));
    if (visit(v) === false) return;
    for (const key of [
      '@graph',
      'mainEntity',
      'mainEntityOfPage',
      'itemListElement',
      'item',
      'hasPart',
    ]) {
      go(v[key], depth + 1);
    }
  };
  go(data, 0);
}

/** Resolves `{ "@id": "…" }` references to the node with that id elsewhere on the page (Yoast graphs). */
class NodeIndex {
  private readonly byId = new Map<string, JsonObject>();

  constructor(data: Json) {
    walk(data, (node) => {
      const id = str(node['@id']);
      if (id && Object.keys(node).length > 1 && !this.byId.has(id))
        this.byId.set(id, node);
    });
  }

  deref(v: Json | undefined): Json | undefined {
    if (!isObject(v)) return v;
    const id = str(v['@id']);
    return id && Object.keys(v).length === 1 ? (this.byId.get(id) ?? v) : v;
  }

  derefAll(v: Json | undefined): Json[] {
    return asArray(v).map((x) => this.deref(x) ?? null);
  }
}

function textOf(v: Json | undefined): string | undefined {
  if (typeof v === 'string') return v;
  if (isObject(v))
    return str(v['text']) ?? str(v['name']) ?? str(v['description']);
  return undefined;
}

/** A blob of instructions: split on lines and on inline "2. " step numbers, then drop the numbers. */
function splitBlob(blob: string): string[] {
  return htmlToText(blob)
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=(?:step\s*)?\d+[.)]\s)/i))
    .map((l) => l.replace(LIST_NUMBER, '').trim())
    .filter(Boolean);
}

/** Instructions come as a string, strings, HowToStep(s) or HowToSection(s) — normalise to sections of lines. */
function instructionSections(
  value: Json | undefined,
  index: NodeIndex,
): RawSection[] {
  const loose: string[] = [];
  const sections: RawSection[] = [];

  const stepLines = (raw: Json): string[] => {
    const item = index.deref(raw);
    if (typeof item === 'string') return splitBlob(item);
    if (!isObject(item)) return [];
    // HowToStep may itself contain HowToDirection / HowToTip items.
    if (
      item['itemListElement'] !== undefined &&
      !hasType(item, 'HowToSection')
    ) {
      const inner = index
        .derefAll(item['itemListElement'])
        .map((x) => textOf(x))
        .filter((x): x is string => !!x);
      if (inner.length) return [cleanLine(inner.join(' '))];
    }
    const t = textOf(item);
    return t ? splitBlob(t) : [];
  };

  for (const item of index.derefAll(value)) {
    if (isObject(item) && hasType(item, 'HowToSection')) {
      const title = str(item['name']);
      sections.push({
        ...(title && { title: cleanLine(title) }),
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
    const text = cleanLine(str(v) ?? textOf(v) ?? '');
    if (!text) continue;
    if (isSectionHeading(text))
      sections.push({ title: headingTitle(text), lines: [] });
    else sections[sections.length - 1]?.lines.push(text);
  }
  return sections;
}

/** Absolute http(s) URL, resolving relative and protocol-relative ones against the page. */
function absoluteUrl(
  url: string | undefined,
  base: string | undefined,
): string | undefined {
  if (!url) return undefined;
  const candidate = url.startsWith('//') ? `https:${url}` : url;
  try {
    if (base) return new URL(candidate, base).href;
    return /^https?:\/\//i.test(candidate)
      ? new URL(candidate).href
      : undefined;
  } catch {
    return undefined;
  }
}

function firstImageUrl(
  v: Json | undefined,
  index: NodeIndex,
): string | undefined {
  for (const item of index.derefAll(v)) {
    const url =
      typeof item === 'string'
        ? item
        : isObject(item)
          ? (str(item['url']) ?? str(item['contentUrl']))
          : undefined;
    if (url) return url;
  }
  return undefined;
}

function names(v: Json | undefined, index: NodeIndex): string[] {
  return index
    .derefAll(v)
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
      .filter(Boolean);
  return [
    ...split(node['recipeCuisine']),
    ...split(node['recipeCategory']),
    ...split(node['keywords']),
  ];
}

export interface JsonLdImportOptions {
  /** The page's URL: becomes the draft's source and resolves relative image URLs. */
  sourceUrl?: string;
  idFactory?: IdFactory;
}

/** Import the first schema.org Recipe found in a page's JSON-LD, or undefined if there is none. */
export function importRecipeFromHtml(
  html: string,
  options: JsonLdImportOptions = {},
): RecipeDraft | undefined {
  const data = extractJsonLd(html);
  let node: JsonObject | undefined;
  walk(data, (n) => {
    if (!node && hasType(n, 'Recipe')) node = n;
    return !node;
  });
  if (!node) return undefined;

  const index = new NodeIndex(data);
  const sourceUrl =
    options.sourceUrl ?? absoluteUrl(str(node['url']), undefined);
  const raw: RawRecipe = {
    sourceType: 'url',
    title: cleanLine(str(node['name']) ?? str(node['headline']) ?? ''),
    description: htmlToText(str(node['description']) ?? ''),
    ...yieldInfo(node['recipeYield'] ?? node['yield']),
    prepMinutes: isoDurationToMinutes(node['prepTime']),
    cookMinutes: isoDurationToMinutes(node['cookTime']),
    totalMinutes: isoDurationToMinutes(node['totalTime']),
    sourceUrl,
    sourceAttribution:
      names(node['author'], index).join(', ') ||
      names(node['publisher'], index).join(', ') ||
      undefined,
    heroImageUrl: absoluteUrl(firstImageUrl(node['image'], index), sourceUrl),
    tags: tagList(node),
    ingredientSections: ingredientSections(
      node['recipeIngredient'] ?? node['ingredients'],
    ),
    stepSections: instructionSections(node['recipeInstructions'], index),
  };
  return buildDraft(raw, options.idFactory);
}
