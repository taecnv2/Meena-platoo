import type { UnitType } from '../units/schemas/unit.schema';

export interface ConvertibleUnit {
  _id: { toString(): string };
  code: string;
  type: UnitType;
  conversionFactor: number;
}

export interface IngredientConversion {
  unitId: { toString(): string };
  factor: number;
}

/** Unit types whose units share a common scale (kg/g, L/ml) and convert automatically via Unit.conversionFactor. */
const SCALED_UNIT_TYPES: UnitType[] = ['WEIGHT', 'VOLUME'];

/**
 * How many base units one `target` unit is worth for a given ingredient, or null when the
 * ingredient cannot be counted in that unit. Lookup order:
 *   1. the base unit itself -> 1
 *   2. an ingredient-specific conversion (1 ลัง = 12 ขวด, 1 ถุง = 5 kg)
 *   3. same WEIGHT/VOLUME type -> ratio of Unit.conversionFactor (1 g = 0.001 kg)
 */
export function resolveConversionFactor(
  baseUnit: ConvertibleUnit,
  target: ConvertibleUnit,
  conversions: IngredientConversion[],
): number | null {
  const targetId = target._id.toString();
  if (targetId === baseUnit._id.toString()) {
    return 1;
  }
  const specific = conversions.find(
    (conversion) => conversion.unitId.toString() === targetId,
  );
  if (specific && specific.factor > 0) {
    return specific.factor;
  }
  if (
    target.type === baseUnit.type &&
    SCALED_UNIT_TYPES.includes(target.type) &&
    target.conversionFactor > 0 &&
    baseUnit.conversionFactor > 0
  ) {
    return target.conversionFactor / baseUnit.conversionFactor;
  }
  return null;
}

/** Quantities are stored in the base unit; 4 decimals keeps g -> kg (0.001) exact without float noise. */
export function roundQuantity(value: number): number {
  return Math.round(value * 10000) / 10000;
}
