// Fails when component code uses literal visual values instead of design tokens
// (docs/adr/0007-design-tokens.md). Literals belong only in src/styles/themes.
//
// Usage: node tools/check-tokens.mjs <dir>...
// A line can opt out with a trailing `tokens-ok: <reason>` comment; use it sparingly.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = new Set(['.ts', '.html', '.css', '.scss']);

const NAMED_COLOURS =
  'white|black|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|silver|gold|navy|teal|maroon|olive|lime|aqua|cyan|magenta|fuchsia|beige|tan|salmon|coral|crimson|indigo|violet|khaki|ivory|lavender|tomato|orchid|plum|turquoise|chocolate|firebrick|darkred|lightgray|lightgrey|darkgray|darkgrey';
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOUR_UTILITIES =
  'bg|text|border(?:-[a-z]{1,2})?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|accent|caret|divide|placeholder|shadow|inset-shadow';

/** A literal colour anywhere in a value: hex, colour function or CSS colour name. */
const LITERAL_COLOUR = new RegExp(
  `#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\\(|\\b(?:${NAMED_COLOURS})\\b`,
  'i',
);

const RULES = [
  {
    name: 'hex colour',
    // After CSS/attribute punctuation, so template refs (#search) and links (href="#main") don't match.
    pattern:
      /(?<=[:([,=]\s*|['"]\s*)(?<!href=["'])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b(?![\w-])/i,
  },
  {
    name: 'colour function',
    pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i,
  },
  {
    name: 'named colour in CSS',
    pattern: new RegExp(
      `(?:^|[;{\\s])(?:color|background(?:-color)?|border(?:-\\w+)?-color|outline-color|fill|stroke|box-shadow)\\s*:[^;{}]*\\b(?:${NAMED_COLOURS})\\b`,
      'i',
    ),
  },
  {
    name: 'literal box-shadow',
    pattern: /box-shadow\s*:\s*(?!var\(|none|inherit|initial|unset)[^;]*\d/i,
  },
  {
    name: 'literal font family',
    pattern: /font-family\s*:\s*(?!var\(|inherit|initial|unset)/i,
  },
  {
    name: 'arbitrary Tailwind value with a colour',
    test: (line) => {
      for (const m of line.matchAll(
        /(?:^|[\s"'`:])(?:[\w-]+:)*[\w-]+-\[([^\]]+)\]/g,
      )) {
        if (!(m[1] ?? '').startsWith('url(') && LITERAL_COLOUR.test(m[1] ?? ''))
          return m[0].trim();
      }
      return undefined;
    },
  },
  {
    name: 'arbitrary Tailwind property with a literal',
    test: (line) => {
      const m =
        /\[(?:color|background(?:-color)?|border-color|box-shadow|font-family|border-radius)\s*:(?!var\()[^\]]*\]/i.exec(
          line,
        );
      return m?.[0];
    },
  },
  { name: 'arbitrary shadow', pattern: /\bshadow-\[(?!var\()[^\]]*\]/ },
  { name: 'arbitrary font', pattern: /\bfont-\[(?!var\()[^\]]*\]/ },
  {
    name: 'arbitrary radius',
    pattern: /\brounded(?:-[a-z]+)?-\[(?!var\()[^\]]*\]/,
  },
  {
    name: 'Tailwind default palette (removed; use a token)',
    pattern: new RegExp(
      `\\b(?:${COLOUR_UTILITIES})-(?:white|black|(?:${PALETTE})-\\d{2,3})\\b`,
    ),
  },
  {
    name: 'Tailwind default radius (removed; use rounded-chip/control/card/sheet/thumb)',
    pattern: /\brounded(?:-[trblse]{1,2})?-(?:xs|sm|md|lg|xl|[234]xl|full)\b/,
  },
  {
    name: 'Tailwind default shadow (removed; use shadow-card/sheet)',
    pattern: /\bshadow-(?:2xs|xs|sm|md|lg|xl|2xl)\b/,
  },
  {
    name: 'Tailwind default font (removed; use font-display/body/num/step)',
    pattern: /\bfont-(?:sans|serif|mono)\b/,
  },
  {
    name: 'inline style binding for colour',
    pattern:
      /\[style\.(?:color|background(?:-color)?|border-color|font-family|box-shadow)\]/i,
  },
  {
    name: 'inline style colour',
    pattern: /style="[^"]*\b(?:color|background|font-family|box-shadow)\s*:/i,
  },
];

/** Problems in one file's text, as `line: rule: match` strings. */
export function checkText(text) {
  const problems = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes('tokens-ok:')) return;
    for (const rule of RULES) {
      const match = rule.test ? rule.test(line) : rule.pattern.exec(line)?.[0];
      if (match) problems.push(`${i + 1}  ${rule.name}: ${match.trim()}`);
    }
  });
  return problems;
}

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (EXTENSIONS.has(extname(path)) && !path.endsWith('.spec.ts'))
      yield path;
  }
}

function main(dirs) {
  if (dirs.length === 0) {
    console.error('Usage: node tools/check-tokens.mjs <dir>...');
    return 2;
  }
  const problems = [];
  for (const dir of dirs) {
    for (const file of files(dir)) {
      for (const p of checkText(readFileSync(file, 'utf8')))
        problems.push(`${relative(process.cwd(), file)}:${p}`);
    }
  }
  if (problems.length) {
    console.error(
      'Design token check failed. Use token utilities (bg-canvas, text-ink, rounded-card, heading, …) instead:\n',
    );
    console.error(problems.join('\n'));
    return 1;
  }
  console.log(`Design token check passed (${dirs.join(', ')}).`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)));
