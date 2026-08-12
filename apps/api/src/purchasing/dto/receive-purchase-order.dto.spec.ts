import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { ReceivePurchaseOrderDto } from './receive-purchase-order.dto';

describe('ReceivePurchaseOrderDto', () => {
  it('rejects two line items with the same ingredientId', async () => {
    const ingredientId = new Types.ObjectId().toString();
    const dto = plainToInstance(ReceivePurchaseOrderDto, {
      items: [
        { ingredientId, quantity: 6 },
        { ingredientId, quantity: 6 },
      ],
    });
    const errors = await validate(dto);
    const itemsError = errors.find((error) => error.property === 'items');
    expect(itemsError).toBeDefined();
    expect(itemsError?.constraints).toHaveProperty('arrayUnique');
  });

  it('accepts distinct ingredientIds', async () => {
    const dto = plainToInstance(ReceivePurchaseOrderDto, {
      items: [
        { ingredientId: new Types.ObjectId().toString(), quantity: 6 },
        { ingredientId: new Types.ObjectId().toString(), quantity: 4 },
      ],
    });
    const errors = await validate(dto);
    expect(errors.find((error) => error.property === 'items')).toBeUndefined();
  });
});
