/** Leading list bullet: "-", "*", "•", checkbox glyphs, dashes. */
export const BULLET = /^\s*[-*•·▢□☐◦‣–—]\s*/u;

/** Leading list number: "1.", "2)", "Step 3:". Requires whitespace after, so "1.5 litres" is not a list number. */
export const LIST_NUMBER = /^\s*(?:step\s*)?\d+\s*[.):]\s+/i;

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const IRREGULAR = new Map([
  ['leaves', 'leaf'],
  ['halves', 'half'],
  ['loaves', 'loaf'],
  ['knives', 'knife'],
  ['potatoes', 'potato'],
  ['tomatoes', 'tomato'],
  ['mangoes', 'mango'],
  ['anchovies', 'anchovy'],
  ['chillies', 'chilli'],
  ['chilies', 'chili'],
  ['cloves', 'clove'],
  ['olives', 'olive'],
  ['chives', 'chive'],
]);

/** Rough English singular for matching ("onions" → "onion", "berries" → "berry"). Not for display. */
export function singular(word: string): string {
  const w = word.toLowerCase();
  const irregular = IRREGULAR.get(w);
  if (irregular) return irregular;
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return w;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Lower-case word tokens (letters, digits, apostrophes inside words). */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];
}

/** A matched range of text; `end` is exclusive. */
export interface TextSpan {
  start: number;
  end: number;
  text: string;
}

export function overlaps(
  a: Pick<TextSpan, 'start' | 'end'>,
  b: Pick<TextSpan, 'start' | 'end'>,
): boolean {
  return a.start < b.end && a.end > b.start;
}
