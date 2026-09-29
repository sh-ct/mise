const NAMED = new Map<string, string>([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', String.fromCharCode(160)],
  ['ndash', '–'],
  ['mdash', '—'],
  ['hellip', '…'],
  ['lsquo', '‘'],
  ['rsquo', '’'],
  ['ldquo', '“'],
  ['rdquo', '”'],
  ['deg', '°'],
  ['times', '×'],
  ['frac12', '½'],
  ['frac14', '¼'],
  ['frac34', '¾'],
  ['frac13', '⅓'],
  ['frac23', '⅔'],
  ['frac18', '⅛'],
  ['eacute', 'é'],
  ['egrave', 'è'],
  ['ecirc', 'ê'],
  ['agrave', 'à'],
  ['aacute', 'á'],
  ['ccedil', 'ç'],
  ['ntilde', 'ñ'],
  ['ouml', 'ö'],
  ['uuml', 'ü'],
  ['auml', 'ä'],
  ['iuml', 'ï'],
  ['szlig', 'ß'],
  ['reg', '®'],
  ['copy', '©'],
  ['trade', '™'],
]);

/** Decode HTML entities (named subset + all numeric). No DOM needed, so it runs in edge functions. */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,10});/gi,
    (whole, code: string) => {
      if (code[0] === '#') {
        const n =
          code[1] === 'x' || code[1] === 'X'
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
      }
      return NAMED.get(code.toLowerCase()) ?? whole;
    },
  );
}

/**
 * Strip tags to plain text, turning block-level boundaries into newlines. Tags are stripped again after
 * decoding, so an encoded "&lt;img onerror=…&gt;" can't come back as markup. The result is still
 * untrusted text: render it with text bindings, never as HTML.
 */
export function htmlToText(html: string): string {
  const text = removeElements(html, ['script', 'style'])
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|ol|ul)\s*>/gi, '\n')
    .replace(/<[^<>]*>/g, '');
  return decodeEntities(text)
    .replace(/<[a-z!/?][^<>]*>?/gi, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Collapse to a single clean line. */
export function cleanLine(text: string): string {
  return htmlToText(text).replace(/\s+/g, ' ').trim();
}

/**
 * Remove whole elements (e.g. scripts, navigation) by name. Linear: scans with indexOf rather than a
 * lazy regex, which goes quadratic on unclosed tags.
 */
export function removeElements(html: string, names: readonly string[]): string {
  const lower = html.toLowerCase();
  // Next known position of each opening tag, only re-searched once `pos` has passed it.
  const nextOpen = names.map((n) => lower.indexOf(`<${n}`));
  let out = '';
  let pos = 0;
  while (pos < html.length) {
    let next = -1;
    let name = '';
    names.forEach((n, k) => {
      if (nextOpen[k] !== -1 && (nextOpen[k] ?? -1) < pos)
        nextOpen[k] = lower.indexOf(`<${n}`, pos);
      const i = nextOpen[k] ?? -1;
      if (i >= 0 && (next < 0 || i < next)) [next, name] = [i, n];
    });
    if (next < 0) break;
    const close = lower.indexOf(`</${name}`, next);
    const end =
      close < 0 ? html.length : lower.indexOf('>', close) + 1 || html.length;
    out += html.slice(pos, next);
    pos = end;
  }
  return out + html.slice(pos);
}
