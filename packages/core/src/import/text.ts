import type { IdFactory } from '../ids';
import { looksLikeIngredient } from '../ingredients/parse-ingredient';
import { parseLeadingQuantity } from '../quantity/quantity';
import type { RecipeDraft } from '../schema/recipe';
import { detectDurations } from '../steps/durations';
import { buildDraft, type RawRecipe, type RawSection } from './draft-builder';

const INGREDIENT_HEADER =
  /^(?:ingredients?|you(?:'ll| will)? need|what you(?:'ll)? need|shopping list)\s*:?\s*$/i;
const STEP_HEADER =
  /^(?:method|instructions?|directions?|steps?|preparation|how to make(?: it)?|to make)\s*:?\s*$/i;
const NOTES_HEADER =
  /^(?:notes?|tips?|cook'?s notes?|storage|variations?)\s*:?\s*$/i;
const META =
  /^(serves|servings?|makes|yields?|prep(?:aration)? time|cook(?:ing)? time|total time|ready in)\b\s*:?\s*(.*)$/i;
const NUMBERED = /^\s*(?:step\s*)?(\d+)\s*[.):-]\s+/i;
const BULLET = /^\s*[-*•·▢□☐◦‣]\s*/u;

type Mode = 'preamble' | 'ingredients' | 'steps' | 'notes';

export interface TextImportOptions {
  sourceType?: 'text' | 'scan';
  idFactory?: IdFactory;
}

const isSubheading = (line: string) =>
  /:$/.test(line) &&
  line.split(/\s+/).length <= 6 &&
  !parseLeadingQuantity(line.replace(BULLET, ''))
    ? true
    : /^for the\s+\S.{0,30}$/i.test(line);

const endsSentence = (line: string) => /[.!?)]["'”’]?$/.test(line);

/**
 * Split pasted or OCR'd recipe text into a draft. Works with and without headings:
 *
 * - "Ingredients" / "Method" style headings switch sections; "For the sauce:" starts a sub-section.
 * - Without headings, quantity-led and short lines are ingredients until the first sentence-like line.
 * - Numbered steps ("1.", "Step 2:") are split on their numbers; hard-wrapped lines are re-joined.
 * - "Serves 4", "Prep time: 15 mins" etc. are read as metadata.
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
    const isNumbered = NUMBERED.test(line);
    const content = line.replace(NUMBERED, '').replace(BULLET, '');
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
    if (meta && line.length < 60) {
      applyMeta(raw, (meta[1] ?? '').toLowerCase(), meta[2] ?? '', line);
      continue;
    }
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
      if (!raw.title && !looksLikeQuantityLine(line) && line.length <= 100) {
        raw.title = line.replace(/[:.]$/, '');
        continue;
      }
      // Headless text: decide per line.
      if (
        looksLikeQuantityLine(line) ||
        (looksLikeIngredient(line) &&
          current(raw.ingredientSections).lines.length > 0)
      ) {
        mode = 'ingredients';
      } else if (
        current(raw.ingredientSections).lines.length > 0 ||
        NUMBERED.test(line)
      ) {
        mode = 'steps';
      } else {
        description.push(line);
        continue;
      }
    }

    if (mode === 'ingredients') {
      if (isSubheading(line)) {
        pushSection(raw.ingredientSections, line);
        continue;
      }
      // Without headings, the first sentence-like line ends the ingredient list.
      if (!sawHeadings && !looksLikeIngredient(line)) {
        mode = 'steps';
      } else {
        current(raw.ingredientSections).lines.push(line.replace(BULLET, ''));
        continue;
      }
    }

    if (mode === 'steps') {
      if (isSubheading(line) && !NUMBERED.test(line)) {
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
    !NUMBERED.test(line) &&
    !!parseLeadingQuantity(text) &&
    text.length <= 80 &&
    !/[.!?]$/.test(text)
  );
}

function pushSection(sections: RawSection[], heading: string) {
  const title = heading.replace(/:$/, '').trim();
  const last = sections[sections.length - 1];
  if (last && last.lines.length === 0 && !last.title) last.title = title;
  else sections.push({ title, lines: [] });
}

function applyMeta(raw: RawRecipe, key: string, value: string, line: string) {
  if (/^(serves|servings?)$/.test(key)) {
    const n = /\d+/.exec(value)?.[0];
    if (n) raw.servings = Number(n);
    if (/[-–]|to/.test(value)) raw.yieldText = line;
    return;
  }
  if (/^(makes|yields?)$/.test(key)) {
    const n = /\d+/.exec(value)?.[0];
    if (n) raw.servings = Number(n);
    raw.yieldText = value.trim() || line;
    return;
  }
  const minutes =
    Math.round((detectDurations(value)[0]?.minSeconds ?? 0) / 60) || undefined;
  if (key.startsWith('prep')) raw.prepMinutes = minutes;
  else if (key.startsWith('cook')) raw.cookMinutes = minutes;
  else raw.totalMinutes = minutes;
}
