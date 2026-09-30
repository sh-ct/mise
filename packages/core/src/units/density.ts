import { escapeRegExp } from '../text/normalize';

export interface Density {
  /** Grams per millilitre. */
  gPerMl: number;
  /** Liquids stay in volume in metric (ml of milk); solids are weighed (g of flour). */
  liquid: boolean;
}

/**
 * Approximate densities for converting between volume and mass. Kitchen-accurate at best: flour in
 * particular varies a lot with how it's scooped. Used only for display conversions, never applied to
 * stored data. Keys are matched against the ingredient item as whole words; the longest key wins.
 */
const LIQUIDS: Record<string, number> = {
  water: 1.0,
  stock: 1.0,
  broth: 1.0,
  milk: 1.03,
  buttermilk: 1.03,
  cream: 1.0,
  oil: 0.92,
  'olive oil': 0.91,
  honey: 1.42,
  'maple syrup': 1.32,
  'golden syrup': 1.42,
  molasses: 1.4,
  treacle: 1.4,
  wine: 0.99,
  vinegar: 1.01,
};

const SOLIDS: Record<string, number> = {
  yoghurt: 1.05,
  yogurt: 1.05,
  butter: 0.96,
  flour: 0.53,
  'plain flour': 0.53,
  'all-purpose flour': 0.53,
  'bread flour': 0.55,
  'self-raising flour': 0.53,
  'self-rising flour': 0.53,
  'wholemeal flour': 0.51,
  'whole wheat flour': 0.51,
  cornflour: 0.54,
  cornstarch: 0.54,
  sugar: 0.85,
  'caster sugar': 0.85,
  'granulated sugar': 0.85,
  'brown sugar': 0.93,
  'icing sugar': 0.51,
  'powdered sugar': 0.51,
  "confectioners' sugar": 0.51,
  'cocoa powder': 0.42,
  cocoa: 0.42,
  oats: 0.38,
  'rolled oats': 0.38,
  rice: 0.8,
  salt: 1.2,
  'kosher salt': 0.6,
  'baking powder': 0.9,
  'baking soda': 1.0,
  'bicarbonate of soda': 1.0,
  'ground almonds': 0.4,
  'almond flour': 0.4,
  breadcrumbs: 0.25,
  panko: 0.2,
};

const TABLE = new Map<string, Density>([
  ...Object.entries(LIQUIDS).map(([k, gPerMl]): [string, Density] => [
    k,
    { gPerMl, liquid: true },
  ]),
  ...Object.entries(SOLIDS).map(([k, gPerMl]): [string, Density] => [
    k,
    { gPerMl, liquid: false },
  ]),
]);

const MATCHERS = [...TABLE.keys()]
  .sort((a, b) => b.length - a.length)
  .map((key) => ({
    key,
    re: new RegExp(`(^|[^\\p{L}])${escapeRegExp(key)}($|[^\\p{L}])`, 'u'),
  }));

export function densityFor(item: string): Density | undefined {
  const lower = item.toLowerCase();
  const match = MATCHERS.find(({ re }) => re.test(lower));
  return match && TABLE.get(match.key);
}
