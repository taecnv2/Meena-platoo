import { REFERENCE_TYPES } from './stock-movement.schema';

describe('StockMovement REFERENCE_TYPES', () => {
  it('includes PURCHASE_ORDER for purchase-order receiving', () => {
    expect(REFERENCE_TYPES).toContain('PURCHASE_ORDER');
  });
});
