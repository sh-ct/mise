import type { IdFactory } from '../ids.ts';
import { looksLikeIngredient } from '../ingredients/parse-ingredient.ts';
import { parseLeadingQuantity } from '../quantity/quantity.ts';
import type { RecipeDraft, SourceType } from '../schema/recipe.ts';
import { detectDurations } from '../steps/durations.ts';
import { BULLET, LIST_NUMBER } from '../text/normalize.ts';
import {
  buildDraft,
  type RawRecipe,
  type RawSection,
} from './draft-builder.ts';
import { headingTitle, isSectionHeading } from './headings.ts';

const INGREDIENT_HEADER =
  /^(?:ingredients?|you(?:'ll| will)? need|what you(?:'ll)? need|shopping list)\s*:?\s*$/i;
const STEP_HEADER =
  /^(?:method|instructions?|directions?|steps?|preparation|how to make(?: it)?|to make)\s*:?\s*$/i;
const NOTES_HEADER =
  /^(?:notes?|tips?|cook'?s notes?|storage|variations?)\s*:?\s*$/i;
const META =
  /^(serves|servings?|makes|yields?|prep(?:aration)? time|cook(?:ing)? time|total time|ready in)\b\s*:?\s*(.*)$/i;

type Mode = 'preamble' | 'ingredients' | 'steps' | 'notes';

export interface TextImportOptions {
  sourceType?: Extract<SourceType, 'text' | 'scan' | 'url'>;
  sourceUrl?: string;
  idFactory?: IdFactory;
}

const endsSentence = (line: string) => /[.!?)]["'”’]?$/.test(line);

/** A method sentence rather than a title: "Just mix everything and bake it." */
const isSentence = (line: string) =>
  endsSentence(line) && line.split(/\s+/).length >= 5;

/**
 * Split pasted or OCR'd recipe text into a draft. Works with and without headings:
 *
 * - "Ingredients" / "Method" style headings switch sections; "For the sauce:" starts a sub-section.
 * - Without headings, quantity-led and short lines are ingredients until the first sentence-like line.
 * - Numbered steps ("1.", "Step 2:") are split on their numbers; hard-wrapped lines are re-joined.
 * - "Serves 4", "Prep time: 15 mins" etc. are read as metadata when a number can be read from them.
 */
export function parseRecipeText(
  text: string,
  options: TextImportOptions = {},
): RecipeDraft {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());

  const raw: RawRecipe = {
    sourceType: options.sourceType ?? 'text',
    ...(options.sourceUrl && { sourceUrl: options.sourceUrl }),
    ingredientSections: [{ lines: [] }],
    stepSections: [{ lines: [] }],
  };
  const description: string[] = [];
  let mode: Mode = 'preamble';
  let sawHeadings = false;
  let numbered = false;
  let prevBlank = false;

  const current = (sections: RawSection[]) =>
    sections[sections.length - 1] as RawSection;
  const addStep = (line: string, forceNew: boolean) => {
    const section = current(raw.stepSections);
    const last = section.lines.length - 1;
    const isNumbered = LIST_NUMBER.test(line);
    const content = line.replace(LIST_NUMBER, '').replace(BULLET, '');
    if (isNumbered) numbered = true;
    const continuation =
      last >= 0 &&
      !forceNew &&
      !isNumbered &&
      !BULLET.test(line) &&
      (numbered || !endsSentence(section.lines[last] ?? ''));
    if (continuation) section.lines[last] = `${section.lines[last]} ${content}`;
    else section.lines.push(content);
  };

  for (const line of lines) {
    if (!line) {
      prevBlank = true;
      continue;
    }
    const blankBefore = prevBlank;
    prevBlank = false;

    const meta = META.exec(line);
    if (
      meta &&
      line.length < 60 &&
      applyMeta(raw, (meta[1] ?? '').toLowerCase(), meta[2] ?? '', line)
    )
      continue;
    if (INGREDIENT_HEADER.test(line)) {
      mode = 'ingredients';
      sawHeadings = true;
      continue;
    }
    if (STEP_HEADER.test(line)) {
      mode = 'steps';
      sawHeadings = true;
      numbered = false;
      continue;
    }
    if (NOTES_HEADER.test(line)) {
      mode = 'notes';
      continue;
    }

    if (mode === 'preamble') {
      if (
        !raw.title &&
        !looksLikeQuantityLine(line) &&
        !isSentence(line) &&
        line.length <= 100
      ) {
        raw.title = line.replace(/[:.]$/, '');
        continue;
      }
      // Headless text: decide per line.
      const haveIngredients = current(raw.ingredientSections).lines.length > 0;
      if (
        looksLikeQuantityLine(line) ||
        (looksLikeIngredient(line) && haveIngredients)
      ) {
        mode = 'ingredients';
      } else if (
        haveIngredients ||
        LIST_NUMBER.test(line) ||
        (!raw.title && isSentence(line))
      ) {
        mode = 'steps';
      } else {
        description.push(line);
        continue;
      }
    }

    if (mode === 'ingredients') {
      if (isSectionHeading(line)) {
        pushSection(raw.ingredientSections, line);
        continue;
      }
      // A numbered sentence starts the method even without a "Method" heading; without any headings,
      // so does the first sentence-like line.
      const numberedStep =
        LIST_NUMBER.test(line) &&
        !looksLikeQuantityLine(line.replace(LIST_NUMBER, ''));
      if (numberedStep || (!sawHeadings && !looksLikeIngredient(line))) {
        mode = 'steps';
        numbered = false;
      } else {
        current(raw.ingredientSections).lines.push(line.replace(BULLET, ''));
        continue;
      }
    }

    if (mode === 'steps') {
      if (isSectionHeading(line)) {
        pushSection(raw.stepSections, line);
        numbered = false;
        continue;
      }
      addStep(line, blankBefore && !numbered);
      continue;
    }

    if (mode === 'notes') description.push(line);
  }

  if (description.length) raw.description = description.join('\n');
  return buildDraft(raw, options.idFactory);
}

function looksLikeQuantityLine(line: string): boolean {
  const text = line.replace(BULLET, '');
  return (
    !LIST_NUMBER.test(line) &&
    !!parseLeadingQuantity(text) &&
    text.length <= 80 &&
    !/[.!?]$/.test(text)
  );
}

function pushSection(sections: RawSection[], heading: string) {
  const title = headingTitle(heading);
  const last = sections[sections.length - 1];
  if (last && last.lines.length === 0 && !last.title) last.title = title;
  else sections.push({ title, lines: [] });
}

/** Apply a metadata line. Returns false when nothing could be read, so the line is kept as text. */
function applyMeta(
  raw: RawRecipe,
  key: string,
  value: string,
  line: string,
): boolean {
  const n = /\d+/.exec(value)?.[0];
  if (/^(serves|servings?)$/.test(key)) {
    if (!n) return false;
    raw.servings = Number(n);
    if (/[-–]|\bto\b/.test(value)) raw.yieldText = line;
    return true;
  }
  if (/^(makes|yields?)$/.test(key)) {
    if (!n) return false;
    raw.servings = Number(n);
    raw.yieldText = value.trim();
    return true;
  }
  const seconds = detectDurations(value)[0]?.minSeconds;
  if (!seconds) return false;
  const minutes = Math.round(seconds / 60);
  if (key.startsWith('prep')) raw.prepMinutes = minutes;
  else if (key.startsWith('cook')) raw.cookMinutes = minutes;
  else raw.totalMinutes = minutes;
  return true;
}
