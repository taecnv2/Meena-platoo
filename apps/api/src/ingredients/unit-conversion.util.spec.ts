import { Types } from 'mongoose';
import { resolveConversionFactor, roundQuantity } from './unit-conversion.util';

const unit = (
  code: string,
  type: 'WEIGHT' | 'VOLUME' | 'COUNT',
  conversionFactor = 1,
) => ({ _id: new Types.ObjectId(), code, type, conversionFactor });

describe('resolveConversionFactor', () => {
  const kg = unit('KG', 'WEIGHT', 1);
  const g = unit('G', 'WEIGHT', 0.001);
  const bottle = unit('BOTTLE', 'COUNT');
  const caseUnit = unit('CASE', 'COUNT');
  const bag = unit('BAG', 'COUNT');
  const ml = unit('ML', 'VOLUME', 0.001);

  it('returns 1 for the base unit itself', () => {
    expect(resolveConversionFactor(bottle, bottle, [])).toBe(1);
  });

  it('uses an ingredient-specific conversion (1 ลัง = 12 ขวด)', () => {
    expect(
      resolveConversionFactor(bottle, caseUnit, [
        { unitId: caseUnit._id, factor: 12 },
      ]),
    ).toBe(12);
  });

  it('converts between weight units via Unit.conversionFactor (g -> kg)', () => {
    expect(resolveConversionFactor(kg, g, [])).toBeCloseTo(0.001);
    expect(resolveConversionFactor(g, kg, [])).toBeCloseTo(1000);
  });

  it('prefers the ingredient-specific conversion over the generic scale (1 ถุง = 5 kg)', () => {
    expect(
      resolveConversionFactor(kg, bag, [{ unitId: bag._id, factor: 5 }]),
    ).toBe(5);
  });

  it('returns null for an unrelated unit', () => {
    expect(resolveConversionFactor(bottle, caseUnit, [])).toBeNull();
    expect(resolveConversionFactor(kg, ml, [])).toBeNull();
  });
});

describe('roundQuantity', () => {
  it('removes float noise at 4 decimals', () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
    expect(roundQuantity(250 * 0.001)).toBe(0.25);
  });
});
