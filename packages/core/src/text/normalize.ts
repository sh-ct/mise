/** Leading list bullet: "-", "*", "•", checkbox glyphs, dashes. */
export const BULLET = /^\s*[-*•·▢□☐◦‣–—]\s*/u;

/** Leading list number: "1.", "2)", "Step 3:". Requires whitespace after, so "1.5 litres" is not a list number. */
export const LIST_NUMBER = /^\s*(?:step\s*)?\d+\s*[.):]\s+/i;

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
