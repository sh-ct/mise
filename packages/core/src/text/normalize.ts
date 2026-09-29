const IRREGULAR: Record<string, string> = {
  leaves: 'leaf',
  halves: 'half',
  loaves: 'loaf',
  knives: 'knife',
  potatoes: 'potato',
  tomatoes: 'tomato',
  mangoes: 'mango',
  anchovies: 'anchovy',
  chillies: 'chilli',
  chilies: 'chili',
  cloves: 'clove',
  olives: 'olive',
  chives: 'chive',
};

/** Rough English singular for matching ("onions" → "onion", "berries" → "berry"). Not for display. */
export function singular(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
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

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
