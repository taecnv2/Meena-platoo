import { allocateProductionCost } from './production-cost.util';

describe('allocateProductionCost', () => {
  it('splits cost by portion weight when every output has one', () => {
    // 4.9 kg salmon @ 440 = 2156 บาท -> 10 x 100 g + 9 x 165 g
    const [perDong, perSashimi] = allocateProductionCost(2156, [
      { baseQuantity: 10, inputQuantity: 10, portionWeight: 100 },
      { baseQuantity: 9, inputQuantity: 9, portionWeight: 165 },
    ]);
    const totalWeight = 10 * 100 + 9 * 165;
    expect(perDong).toBeCloseTo((2156 * 1000) / totalWeight / 10, 3);
    expect(perSashimi).toBeCloseTo((2156 * 1485) / totalWeight / 9, 3);
    expect(perDong * 10 + perSashimi * 9).toBeCloseTo(2156, 1);
  });

  it('splits evenly per unit produced when a portion weight is missing', () => {
    expect(
      allocateProductionCost(300, [
        { baseQuantity: 10, inputQuantity: 10, portionWeight: 100 },
        { baseQuantity: 5, inputQuantity: 5 },
      ]),
    ).toEqual([20, 20]);
  });

  it('returns zero costs when nothing was produced', () => {
    expect(
      allocateProductionCost(100, [{ baseQuantity: 0, inputQuantity: 0 }]),
    ).toEqual([0]);
  });
});
