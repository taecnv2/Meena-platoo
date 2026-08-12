import { PurchaseOrderSchema } from './purchase-order.schema';

describe('PurchaseOrderSchema', () => {
  it('defines the expected top-level fields', () => {
    const paths = Object.keys(PurchaseOrderSchema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'code',
        'supplierId',
        'status',
        'items',
        'deliveryZoneId',
        'createdBy',
        'approvedBy',
        'rejectedBy',
        'rejectionReason',
        'cancelledBy',
        'approvedAt',
        'completedAt',
        'remark',
      ]),
    );
  });

  it('defaults status to DRAFT', () => {
    const statusPath = PurchaseOrderSchema.path('status') as unknown as {
      defaultValue: unknown;
    };
    expect(statusPath.defaultValue).toBe('DRAFT');
  });
});
