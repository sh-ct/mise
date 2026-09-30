import { BULLET } from '../text/normalize';

/**
 * A sub-section heading inside an ingredient list or method: "For the sauce:", "Dressing:",
 * "For the drizzle". Short, no digits, no sentence punctuation — so "For the best flavour, rest it."
 * and "2 eggs:" are not headings.
 */
export function isSectionHeading(line: string): boolean {
  const text = line.replace(BULLET, '').trim();
  if (!text || /\d/.test(text) || text.split(/\s+/).length > 6) return false;
  const body = text.replace(/:$/, '');
  if (/[.,;!?]/.test(body)) return false;
  return text.endsWith(':') || /^for the\s+\S/i.test(text);
}

export function headingTitle(line: string): string {
  return line.replace(BULLET, '').trim().replace(/:$/, '');
}
