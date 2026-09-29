import { densityFor } from './density';
import { getUnit, type Dimension, type MeasurementSystem } from './units';

/**
 * Convert a quantity between units. Mass↔volume needs a density (g/ml), e.g. from `densityFor(item)`.
 * Returns undefined when the conversion isn't possible (count units, unknown units, missing density).
 */
export function convert(
  value: number,
  from: string,
  to: string,
  gPerMl?: number,
): number | undefined {
  if (from === to) return value;
  const a = getUnit(from);
  const b = getUnit(to);
  if (!a?.toBase || !b?.toBase) return undefined;
  const base = value * a.toBase;
  if (a.dimension === b.dimension) return base / b.toBase;
  if (gPerMl === undefined) return undefined;
  if (a.dimension === 'volume' && b.dimension === 'mass')
    return (base * gPerMl) / b.toBase;
  if (a.dimension === 'mass' && b.dimension === 'volume')
    return base / gPerMl / b.toBase;
  return undefined;
}

// Units we choose between when presenting a quantity in a given system, smallest first.
const DISPLAY_UNITS: Record<
  MeasurementSystem,
  Partial<Record<Dimension, string[]>>
> = {
  metric: { mass: ['g', 'kg'], volume: ['ml', 'l'], length: ['mm', 'cm'] },
  us: { mass: ['oz', 'lb'], volume: ['tsp', 'tbsp', 'cup'], length: ['inch'] },
};

// Minimum amount (in that unit) before we step up to it: 1000 g → 1 kg, 3 tsp → 1 tbsp, ¼ cup = 4 tbsp.
const STEP_UP_AT: Record<string, number> = {
  kg: 1,
  l: 1,
  cm: 1,
  lb: 1,
  tbsp: 1,
  cup: 0.25,
};

export interface ConvertedQuantity {
  value: number;
  unit: string;
}

/**
 * Express a quantity in the target measurement system using the most readable unit
 * (1500 g → 1.5 kg; 250 ml → 1 cup). Spoons are kept as they are in both systems.
 *
 * With `item`, known ingredients switch dimension the way each system's cooks expect: metric weighs
 * solids (1 cup flour → 125 g) but keeps liquids in ml; US measures by volume (125 g flour → 1 cup).
 *
 * Returns undefined for count units or when conversion isn't possible.
 */
export function toSystem(
  value: number,
  unitCode: string,
  system: MeasurementSystem,
  options: { item?: string } = {},
): ConvertedQuantity | undefined {
  const unit = getUnit(unitCode);
  if (!unit?.toBase || unit.dimension === 'count') return undefined;
  if (!unit.system) return { value, unit: unitCode };

  const density = options.item ? densityFor(options.item) : undefined;
  let dimension = unit.dimension;
  if (density && (unit.dimension === 'mass' || unit.dimension === 'volume')) {
    dimension = system === 'us' || density.liquid ? 'volume' : 'mass';
  }
  if (unit.system === system && dimension === unit.dimension)
    return { value, unit: unitCode };

  const candidates = DISPLAY_UNITS[system][dimension];
  if (!candidates) return undefined;

  let best: ConvertedQuantity | undefined;
  for (const code of candidates) {
    const converted = convert(value, unitCode, code, density?.gPerMl);
    if (converted === undefined) continue;
    if (!best || converted >= (STEP_UP_AT[code] ?? 0))
      best = { value: converted, unit: code };
  }
  return best;
}
