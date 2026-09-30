export type Dimension = 'mass' | 'volume' | 'length' | 'count';
export type MeasurementSystem = 'metric' | 'us';

export interface UnitDef {
  code: string;
  dimension: Dimension;
  /** Factor to the dimension's base unit (g, ml, mm). Count units have no conversion. */
  toBase?: number;
  /** Which system the unit belongs to. Unset for spoons (used by both) and count units. */
  system?: MeasurementSystem;
  singular: string;
  plural: string;
  /** Short display form, e.g. "tbsp". Falls back to singular/plural. */
  abbr?: string;
  /** Lower-case aliases (plus exact-case ones in `caseSensitiveAliases`). */
  aliases: string[];
  caseSensitiveAliases?: string[];
}

// US customary volumes. Spoons are shared by both systems: metric tsp/tbsp (5/15 ml) differ by <2%.
const TSP_ML = 4.92892;

const COUNT_UNITS: Array<
  [singular: string, plural: string, extraAliases?: string[]]
> = [
  ['pinch', 'pinches'],
  ['dash', 'dashes'],
  ['drop', 'drops'],
  ['clove', 'cloves'],
  ['can', 'cans'],
  ['tin', 'tins'],
  ['jar', 'jars'],
  ['bottle', 'bottles'],
  ['packet', 'packets', ['pack', 'packs', 'pkt', 'pkts']],
  ['package', 'packages', ['pkg', 'pkgs']],
  ['bag', 'bags'],
  ['handful', 'handfuls'],
  ['bunch', 'bunches'],
  ['sprig', 'sprigs'],
  ['stalk', 'stalks'],
  ['stick', 'sticks'],
  ['slice', 'slices'],
  ['sheet', 'sheets'],
  ['head', 'heads'],
  ['leaf', 'leaves'],
  ['knob', 'knobs'],
  ['piece', 'pieces', ['pc', 'pcs']],
  ['fillet', 'fillets'],
  ['rasher', 'rashers'],
  ['cube', 'cubes'],
  ['scoop', 'scoops'],
  ['sachet', 'sachets'],
  ['envelope', 'envelopes'],
];

export const UNITS: readonly UnitDef[] = [
  // mass
  {
    code: 'mg',
    dimension: 'mass',
    toBase: 0.001,
    system: 'metric',
    singular: 'milligram',
    plural: 'milligrams',
    abbr: 'mg',
    aliases: ['mg', 'milligram', 'milligrams', 'milligramme', 'milligrammes'],
  },
  {
    code: 'g',
    dimension: 'mass',
    toBase: 1,
    system: 'metric',
    singular: 'gram',
    plural: 'grams',
    abbr: 'g',
    aliases: ['g', 'gr', 'gm', 'gms', 'gram', 'grams', 'gramme', 'grammes'],
  },
  {
    code: 'kg',
    dimension: 'mass',
    toBase: 1000,
    system: 'metric',
    singular: 'kilogram',
    plural: 'kilograms',
    abbr: 'kg',
    aliases: [
      'kg',
      'kgs',
      'kilo',
      'kilos',
      'kilogram',
      'kilograms',
      'kilogramme',
      'kilogrammes',
    ],
  },
  {
    code: 'oz',
    dimension: 'mass',
    toBase: 28.3495,
    system: 'us',
    singular: 'ounce',
    plural: 'ounces',
    abbr: 'oz',
    aliases: ['oz', 'ozs', 'ounce', 'ounces'],
  },
  {
    code: 'lb',
    dimension: 'mass',
    toBase: 453.592,
    system: 'us',
    singular: 'pound',
    plural: 'pounds',
    abbr: 'lb',
    aliases: ['lb', 'lbs', 'pound', 'pounds'],
  },

  // volume
  {
    code: 'ml',
    dimension: 'volume',
    toBase: 1,
    system: 'metric',
    singular: 'millilitre',
    plural: 'millilitres',
    abbr: 'ml',
    aliases: [
      'ml',
      'mls',
      'millilitre',
      'millilitres',
      'milliliter',
      'milliliters',
      'cc',
    ],
  },
  {
    code: 'cl',
    dimension: 'volume',
    toBase: 10,
    system: 'metric',
    singular: 'centilitre',
    plural: 'centilitres',
    abbr: 'cl',
    aliases: ['cl', 'centilitre', 'centilitres', 'centiliter', 'centiliters'],
  },
  {
    code: 'dl',
    dimension: 'volume',
    toBase: 100,
    system: 'metric',
    singular: 'decilitre',
    plural: 'decilitres',
    abbr: 'dl',
    aliases: ['dl', 'decilitre', 'decilitres', 'deciliter', 'deciliters'],
  },
  {
    code: 'l',
    dimension: 'volume',
    toBase: 1000,
    system: 'metric',
    singular: 'litre',
    plural: 'litres',
    abbr: 'l',
    aliases: ['l', 'litre', 'litres', 'liter', 'liters', 'ltr', 'ltrs'],
  },
  {
    code: 'tsp',
    dimension: 'volume',
    toBase: TSP_ML,
    singular: 'teaspoon',
    plural: 'teaspoons',
    abbr: 'tsp',
    aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 'tspn'],
    caseSensitiveAliases: ['t'],
  },
  {
    code: 'tbsp',
    dimension: 'volume',
    toBase: TSP_ML * 3,
    singular: 'tablespoon',
    plural: 'tablespoons',
    abbr: 'tbsp',
    aliases: [
      'tbsp',
      'tbsps',
      'tbs',
      'tbl',
      'tbls',
      'tblsp',
      'tablespoon',
      'tablespoons',
    ],
    caseSensitiveAliases: ['T', 'Tb'],
  },
  {
    code: 'fl_oz',
    dimension: 'volume',
    toBase: TSP_ML * 6,
    system: 'us',
    singular: 'fluid ounce',
    plural: 'fluid ounces',
    abbr: 'fl oz',
    aliases: ['fl oz', 'fl. oz', 'floz', 'fluid ounce', 'fluid ounces'],
  },
  {
    code: 'cup',
    dimension: 'volume',
    toBase: TSP_ML * 48,
    system: 'us',
    singular: 'cup',
    plural: 'cups',
    aliases: ['cup', 'cups', 'c'],
  },
  {
    code: 'pint',
    dimension: 'volume',
    toBase: TSP_ML * 96,
    system: 'us',
    singular: 'pint',
    plural: 'pints',
    abbr: 'pt',
    aliases: ['pint', 'pints', 'pt', 'pts'],
  },
  {
    code: 'quart',
    dimension: 'volume',
    toBase: TSP_ML * 192,
    system: 'us',
    singular: 'quart',
    plural: 'quarts',
    abbr: 'qt',
    aliases: ['quart', 'quarts', 'qt', 'qts'],
  },
  {
    code: 'gallon',
    dimension: 'volume',
    toBase: TSP_ML * 768,
    system: 'us',
    singular: 'gallon',
    plural: 'gallons',
    abbr: 'gal',
    aliases: ['gallon', 'gallons', 'gal', 'gals'],
  },

  // length (e.g. "2 cm piece of ginger")
  {
    code: 'mm',
    dimension: 'length',
    toBase: 1,
    system: 'metric',
    singular: 'millimetre',
    plural: 'millimetres',
    abbr: 'mm',
    aliases: ['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters'],
  },
  {
    code: 'cm',
    dimension: 'length',
    toBase: 10,
    system: 'metric',
    singular: 'centimetre',
    plural: 'centimetres',
    abbr: 'cm',
    aliases: [
      'cm',
      'cms',
      'centimetre',
      'centimetres',
      'centimeter',
      'centimeters',
    ],
  },
  {
    code: 'inch',
    dimension: 'length',
    toBase: 25.4,
    system: 'us',
    singular: 'inch',
    plural: 'inches',
    abbr: 'in',
    aliases: ['inch', 'inches', '"'],
  },

  // count-like units: never converted, but scaled
  ...COUNT_UNITS.map(([singular, plural, extra = []]): UnitDef => ({
    code: singular,
    dimension: 'count',
    singular,
    plural,
    aliases: [singular, plural, ...extra],
  })),
];

const byCode = new Map(UNITS.map((u) => [u.code, u]));

export function getUnit(code: string | undefined): UnitDef | undefined {
  return code === undefined ? undefined : byCode.get(code);
}

interface AliasEntry {
  alias: string;
  unit: UnitDef;
  caseSensitive: boolean;
}

// Longest first so "fl oz" wins over "fl" and "tbsp" over "t".
const ALIASES: AliasEntry[] = UNITS.flatMap((unit) => [
  ...unit.aliases.map((alias) => ({ alias, unit, caseSensitive: false })),
  ...(unit.caseSensitiveAliases ?? []).map((alias) => ({
    alias,
    unit,
    caseSensitive: true,
  })),
]).sort((a, b) => b.alias.length - a.alias.length);

/**
 * Match a unit at the start of `text`. The alias must end at a word boundary (so "g" doesn't match
 * "garlic"), may be followed by "." and an optional "of".
 */
export function matchUnitPrefix(
  text: string,
): { unit: UnitDef; length: number } | undefined {
  const lower = text.toLowerCase();
  for (const { alias, unit, caseSensitive } of ALIASES) {
    const hay = caseSensitive ? text : lower;
    if (!hay.startsWith(alias)) continue;
    const next = text.charAt(alias.length);
    if (next && /[\p{L}\p{N}]/u.test(next)) continue;
    let length = alias.length;
    if (text.charAt(length) === '.') length++;
    const of = /^\s+of\b/i.exec(text.slice(length));
    if (of) length += of[0].length;
    return { unit, length };
  }
  return undefined;
}

/** Look up a unit from a free-form string ("Tbsp", "grams"). */
export function parseUnit(text: string): UnitDef | undefined {
  const trimmed = text.trim();
  const m = matchUnitPrefix(trimmed);
  return m && m.length >= trimmed.replace(/\.$/, '').length
    ? m.unit
    : undefined;
}

export function unitLabel(
  code: string,
  quantity: number | undefined,
  style: 'abbr' | 'long' = 'abbr',
): string {
  const unit = getUnit(code);
  if (!unit) return code;
  if (style === 'abbr' && unit.abbr) return unit.abbr;
  return quantity !== undefined && quantity > 1 ? unit.plural : unit.singular;
}
