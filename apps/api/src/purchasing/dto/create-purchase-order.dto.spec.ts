import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';

describe('CreatePurchaseOrderDto', () => {
  it('rejects two line items with the same ingredientId', async () => {
    const ingredientId = new Types.ObjectId().toString();
    const dto = plainToInstance(CreatePurchaseOrderDto, {
      supplierId: new Types.ObjectId().toString(),
      items: [
        { ingredientId, orderedQuantity: 5, unitCost: 10 },
        { ingredientId, orderedQuantity: 3, unitCost: 12 },
      ],
    });
    const errors = await validate(dto);
    const itemsError = errors.find((error) => error.property === 'items');
    expect(itemsError).toBeDefined();
    expect(itemsError?.constraints).toHaveProperty('arrayUnique');
  });

  it('accepts distinct ingredientIds', async () => {
    const dto = plainToInstance(CreatePurchaseOrderDto, {
      supplierId: new Types.ObjectId().toString(),
      items: [
        { ingredientId: new Types.ObjectId().toString(), orderedQuantity: 5, unitCost: 10 },
        { ingredientId: new Types.ObjectId().toString(), orderedQuantity: 3, unitCost: 12 },
      ],
    });
    const errors = await validate(dto);
    expect(errors.find((error) => error.property === 'items')).toBeUndefined();
  });
});
