import { newId, type IdFactory } from '../ids';
import { parseLeadingQuantity } from '../quantity/quantity';
import type { Ingredient } from '../schema/recipe';
import { matchUnitPrefix } from '../units/units';

export interface ParsedIngredient {
  qtyMin?: number;
  qtyMax?: number;
  unit?: string;
  item: string;
  prepNote?: string;
  note?: string;
  optional: boolean;
  rawText: string;
}

const BULLET = /^\s*(?:[-*•·▢□☐◦‣–—]|\d+[.)](?=\s))\s*/u;
const OPTIONAL = /\s*(?:\(\s*optional\s*\)|,?\s*\boptional\b\s*[:,]?)\s*/i;
const TO_TASTE =
  /,?\s*\b(to taste|as needed|as required|for (?:serving|garnish|dusting|greasing|frying|brushing)[^,]*)\s*$/i;

/**
 * Parse a single ingredient line into structured parts. Never throws: anything that can't be understood
 * stays in `item`, and the original line is always kept in `rawText`.
 *
 *   "2 cups (250 g) plain flour, sifted" → { qtyMin: 2, unit: 'cup', item: 'plain flour', prepNote: 'sifted', note: '250 g' }
 *   "1 (14 oz) can chopped tomatoes"     → { qtyMin: 1, unit: 'can', item: 'chopped tomatoes', note: '14 oz' }
 *   "Salt and pepper, to taste"          → { item: 'Salt and pepper', prepNote: 'to taste' }
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const rawText = line.trim();
  let rest = rawText.replace(BULLET, '').replace(/\s+/g, ' ').trim();
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

  // Quantity: numbers anywhere at the start; word quantities ("a", "two") only when followed by a unit.
  let qty = parseLeadingQuantity(rest);
  if (!qty) {
    const word = parseLeadingQuantity(rest, { allowWords: true });
    if (word && matchUnitPrefix(rest.slice(word.length))) qty = word;
  }
  let qtyMin: number | undefined;
  let qtyMax: number | undefined;
  if (qty) {
    qtyMin = qty.min;
    qtyMax = qty.max;
    rest = rest.slice(qty.length);
  }

  // "1 (14 oz) can …" — a parenthetical between the quantity and the unit is a size note.
  if (qty) {
    const paren = /^\(([^)]*)\)\s*/.exec(rest);
    if (paren) {
      notes.push((paren[1] ?? '').trim());
      rest = rest.slice(paren[0].length);
    }
  }

  let unit: string | undefined;
  if (qty) {
    // "2 x 400g" style multipliers are left alone; "2 large eggs" has no unit.
    const u = matchUnitPrefix(rest);
    if (u) {
      unit = u.unit.code;
      rest = rest.slice(u.length).trimStart();
    }
  } else {
    // "pinch of salt", "handful of basil" without a quantity
    const u = matchUnitPrefix(rest);
    if (
      u &&
      /\bof\b/i.test(rest.slice(0, u.length)) &&
      u.unit.dimension === 'count'
    ) {
      unit = u.unit.code;
      qtyMin = 1;
      rest = rest.slice(u.length).trimStart();
    }
  }

  // Alternative measure right after the unit: "2 cups (250 g) flour", "200g / 7oz flour"
  const alt =
    /^(?:\(([^)]*)\)|\/\s*([\d.,½¼¾⅓⅔]+\s*[a-z. ]{1,8}?)(?=\s))\s*/i.exec(rest);
  if (alt && (unit || qty)) {
    notes.push((alt[1] ?? alt[2] ?? '').trim());
    rest = rest.slice(alt[0].length);
  }
  rest = rest.replace(/^of\s+/i, '');

  const toTaste = TO_TASTE.exec(rest);
  if (toTaste) {
    prep.push((toTaste[1] ?? '').trim());
    rest = rest.slice(0, toTaste.index).trim();
  }

  // Trailing parenthetical: "flour (plain)" → note
  const trailingParen = /\s*\(([^)]*)\)\s*$/.exec(rest);
  if (trailingParen && trailingParen.index > 0) {
    notes.push((trailingParen[1] ?? '').trim());
    rest = rest.slice(0, trailingParen.index);
  }

  // First comma separates item from preparation: "onion, finely diced"
  const comma = splitOutsideParens(rest);
  let item = comma[0].trim();
  if (comma[1]) prep.unshift(comma[1].trim());

  item = item.replace(/[,;:]$/, '').trim();
  if (!item) {
    // Nothing left (e.g. line was only a quantity): fall back to the raw text rather than lose it.
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
  const words = text.split(/\s+/).length;
  // Short, no sentence punctuation: "Salt and pepper", "Fresh coriander, to serve"
  return words <= 6 && !/[.!?]$/.test(text) && !/:$/.test(text);
}
