import { newId, type IdFactory } from '../ids.ts';
import { parseLeadingQuantity } from '../quantity/quantity.ts';
import type { Ingredient } from '../schema/recipe.ts';
import { BULLET, LIST_NUMBER } from '../text/normalize.ts';
import { convert } from '../units/convert.ts';
import { matchUnitPrefix } from '../units/units.ts';

export type ParsedIngredient = Omit<Ingredient, 'id'>;

const OPTIONAL = /\s*(?:\(\s*optional\s*\)|,?\s*\boptional\b\s*[:,]?)\s*/i;
const SIZE_BEFORE_UNIT =
  /^(small|medium|large|big|heaped|heaping|level|rounded|generous|scant|good)\s+/i;
const MULTIPLIER = /^[x×]\s*/i;
const TO_TASTE =
  /,?\s*\b(to taste|as needed|as required|to (?:serve|garnish|decorate)|for (?:serving|garnish|dusting|greasing|frying|brushing)[^,]*)\s*$/i;

/**
 * Parse a single ingredient line into structured parts. Never throws: anything that can't be understood
 * stays in `item`, and the original line is always kept in `rawText`.
 *
 *   "2 cups (250 g) plain flour, sifted" → { qtyMin: 2, unit: 'cup', item: 'plain flour', prepNote: 'sifted', note: '250 g' }
 *   "2 x 400g tins chopped tomatoes"     → { qtyMin: 2, unit: 'tin', item: 'chopped tomatoes', note: '400g' }
 *   "Salt and pepper, to taste"          → { item: 'Salt and pepper', prepNote: 'to taste' }
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const rawText = line.trim();
  let rest = rawText
    .replace(BULLET, '')
    .replace(LIST_NUMBER, '')
    .replace(/\s+/g, ' ')
    .trim();
  const notes: string[] = [];
  const prep: string[] = [];

  let optional = false;
  if (OPTIONAL.test(rest)) {
    optional = true;
    rest = rest
      .replace(OPTIONAL, ' ')
      .trim()
      .replace(/^,\s*|\s*,$/g, '');
  }

  let qtyMin: number | undefined;
  let qtyMax: number | undefined;
  let unit: string | undefined;

  // Word quantities ("a", "two") only count when a unit follows: "a pinch of salt", not "a few leaves".
  let qty = parseLeadingQuantity(rest);
  if (!qty) {
    const word = parseLeadingQuantity(rest, { allowWords: true });
    if (word && matchUnitPrefix(rest.slice(word.length))) qty = word;
  }

  if (qty) {
    qtyMin = qty.min;
    qtyMax = qty.max;
    rest = rest.slice(qty.length);

    // Pack size between the count and the container: "1 (14 oz) can", "2 x 400g tins".
    const paren = /^\(([^()]*)\)\s*/.exec(rest);
    const packSize = paren ? undefined : measureAfter(rest, MULTIPLIER);
    if (paren) {
      notes.push((paren[1] ?? '').trim());
      rest = rest.slice(paren[0].length);
    } else if (packSize) {
      notes.push(packSize.text);
      rest = rest.slice(packSize.length);
    }

    // "1 small bunch parsley", "1 heaped tbsp flour": a size word before a unit is a note.
    const size = SIZE_BEFORE_UNIT.exec(rest);
    if (size && matchUnitPrefix(rest.slice(size[0].length))) {
      notes.push((size[1] ?? '').toLowerCase());
      rest = rest.slice(size[0].length);
    }

    const u = matchUnitPrefix(rest);
    if (u) {
      unit = u.unit.code;
      rest = rest.slice(u.length).trimStart();

      // "1 lb 2 oz beef" → 18 oz (the original wording stays in rawText)
      const second = qtyMax === undefined ? measureAt(rest) : undefined;
      const combined = second && convert(qtyMin, unit, second.unit);
      if (second && combined !== undefined && second.unit !== unit) {
        qtyMin = combined + second.value;
        unit = second.unit;
        rest = rest.slice(second.length);
      }
    }
  } else {
    // "pinch of salt", "handful of basil" without a quantity
    const u = matchUnitPrefix(rest);
    if (
      u &&
      u.unit.dimension === 'count' &&
      /\bof\b/i.test(rest.slice(0, u.length))
    ) {
      unit = u.unit.code;
      qtyMin = 1;
      rest = rest.slice(u.length).trimStart();
    }
  }

  // Alternative measure after the unit: "2 cups (250 g) flour", "100ml/3½fl oz milk"
  if (qty) {
    const paren = /^\(([^()]*)\)\s*/.exec(rest);
    const alt = paren ? undefined : measureAfter(rest, /^\/\s*/);
    if (paren) {
      notes.push((paren[1] ?? '').trim());
      rest = rest.slice(paren[0].length);
    } else if (alt) {
      notes.push(alt.text);
      rest = rest.slice(alt.length);
    }
  }
  rest = rest.replace(/^of\s+/i, '');

  const toTaste = TO_TASTE.exec(rest);
  if (toTaste) {
    prep.push((toTaste[1] ?? '').trim());
    rest = rest.slice(0, toTaste.index).trim();
  }

  // Trailing parenthetical: "flour (plain)" → note
  const trailingParen = /\s*\(([^()]*)\)\s*$/.exec(rest);
  if (trailingParen && trailingParen.index > 0) {
    notes.push((trailingParen[1] ?? '').trim());
    rest = rest.slice(0, trailingParen.index);
  }

  // First comma separates item from preparation: "onion, finely diced"
  const [head, tail] = splitOutsideParens(rest);
  const item = head
    .trim()
    .replace(/[,;:]$/, '')
    .trim();
  if (tail) prep.unshift(tail.trim());

  if (!item) {
    // Nothing left (e.g. the line was only a quantity): keep the raw text as the item rather than lose it.
    return { item: rawText, optional, rawText };
  }

  const prepNote = prep.filter(Boolean).join(', ') || undefined;
  const note = notes.filter(Boolean).join('; ') || undefined;
  return {
    ...(qtyMin !== undefined && { qtyMin }),
    ...(qtyMax !== undefined && { qtyMax }),
    ...(unit !== undefined && { unit }),
    item,
    ...(prepNote && { prepNote }),
    ...(note && { note }),
    optional,
    rawText,
  };
}

interface Measure {
  value: number;
  unit: string;
  /** Matched text, trimmed. */
  text: string;
  /** Characters consumed, including trailing whitespace. */
  length: number;
}

/** A non-count measure ("400g", "3½ fl oz") at the start of `text`. */
function measureAt(text: string): Measure | undefined {
  const q = parseLeadingQuantity(text);
  if (!q || q.max !== undefined) return undefined;
  const u = matchUnitPrefix(text.slice(q.length));
  if (!u || u.unit.dimension === 'count') return undefined;
  const end = q.length + u.length;
  const length = end + (/^\s*/.exec(text.slice(end))?.[0].length ?? 0);
  return {
    value: q.min,
    unit: u.unit.code,
    text: text.slice(0, end).trim(),
    length,
  };
}

/** A measure introduced by `prefix` ("x 400g", "/ 7oz"); `length` includes the prefix. */
function measureAfter(text: string, prefix: RegExp): Measure | undefined {
  const p = prefix.exec(text);
  if (!p) return undefined;
  const m = measureAt(text.slice(p[0].length));
  return m && { ...m, length: p[0].length + m.length };
}

function splitOutsideParens(text: string): [string, string | undefined] {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0)
      return [text.slice(0, i), text.slice(i + 1)];
  }
  return [text, undefined];
}

/** Parse a line into a full `Ingredient` with a fresh id. */
export function toIngredient(
  line: string,
  idFactory: IdFactory = newId,
): Ingredient {
  return { id: idFactory(), ...parseIngredientLine(line) };
}

/** Heuristic: does this line look like an ingredient (vs a method step or heading)? */
export function looksLikeIngredient(line: string): boolean {
  const text = line.replace(BULLET, '').trim();
  if (!text || text.length > 120) return false;
  if (parseLeadingQuantity(text)) return true;
  // Short, no sentence punctuation: "Salt and pepper", "Fresh coriander, to serve"
  return text.split(/\s+/).length <= 6 && !/[.!?:]$/.test(text);
}
