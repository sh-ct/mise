// Fails when component code uses literal visual values instead of design tokens
// (docs/adr/0007-design-tokens.md). Theme files in src/styles/themes are the only place literals belong.
//
// Usage: node tools/check-tokens.mjs <dir>...
// A line can opt out with a trailing `tokens-ok: <reason>` comment; use it sparingly.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const EXTENSIONS = new Set(['.ts', '.html', '.css', '.scss']);

const RULES = [
  {
    name: 'hex colour',
    pattern:
      /(?<![\w&/-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b(?![\w-])/i,
  },
  {
    name: 'colour function',
    pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i,
  },
  {
    name: 'named colour in CSS',
    pattern:
      /(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-\w+)?-color|fill|stroke)\s*:\s*(?!var\(|inherit|currentColor|transparent|none)[a-z]+\s*[;}]/i,
  },
  {
    name: 'arbitrary Tailwind colour',
    pattern:
      /\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|accent|caret|divide|placeholder|shadow)-\[(?!var\(|length:|\d)[^\]]*\]/,
  },
  { name: 'arbitrary font', pattern: /\bfont-\[(?!var\()[^\]]*\]/ },
  {
    name: 'arbitrary radius',
    pattern: /\brounded(?:-[a-z]+)?-\[(?!var\()[^\]]*\]/,
  },
  {
    name: 'literal font family',
    pattern: /font-family\s*:\s*(?!var\(|inherit)/i,
  },
  {
    name: 'inline style colour',
    pattern: /style="[^"]*\b(?:color|background|font-family)\s*:/i,
  },
];

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (EXTENSIONS.has(extname(path)) && !path.endsWith('.spec.ts'))
      yield path;
  }
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Usage: node tools/check-tokens.mjs <dir>...');
  process.exit(2);
}

const problems = [];
for (const dir of dirs) {
  for (const file of files(dir)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (line.includes('tokens-ok:')) return;
        for (const rule of RULES) {
          const match = rule.pattern.exec(line);
          if (match)
            problems.push(
              `${relative(process.cwd(), file)}:${i + 1}  ${rule.name}: ${match[0].trim()}`,
            );
        }
      });
  }
}

if (problems.length) {
  console.error(
    `Design token check failed. Use token utilities (bg-canvas, text-ink, rounded-card, heading, …) instead:\n`,
  );
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Design token check passed (${dirs.join(', ')}).`);
