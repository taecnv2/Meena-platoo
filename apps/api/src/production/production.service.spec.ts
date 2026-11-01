import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionService } from './production.service';
import { ProductionBatch } from './schemas/production-batch.schema';

describe('ProductionService', () => {
  let service: ProductionService;
  const zoneId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const salmonId = new Types.ObjectId().toString();
  const dongId = new Types.ObjectId().toString();
  const sashimiId = new Types.ObjectId().toString();
  const session = {};
  const owner = { id: userId, permissions: ['ingredients.update'] };

  const kg = { code: 'KG', type: 'WEIGHT', conversionFactor: 1 };
  const bag = { code: 'BAG', type: 'COUNT', conversionFactor: 1 };
  const resolved = (
    id: string,
    quantity: number,
    unit: typeof kg,
    defaultCost = 0,
  ) => ({
    ingredient: { _id: new Types.ObjectId(id), defaultCost, baseUnitId: unit },
    baseQuantity: quantity,
    baseUnit: unit.code,
    factor: 1,
    inputQuantity: quantity,
    inputUnit: unit.code,
  });

  let batchModel: { create: jest.Mock; countDocuments: jest.Mock };
  let ingredientsService: { resolveQuantity: jest.Mock; update: jest.Mock };
  let inventoryService: {
    withTransaction: jest.Mock;
    increment: jest.Mock;
    decrement: jest.Mock;
  };

  beforeEach(async () => {
    batchModel = {
      create: jest.fn((docs: Array<Record<string, unknown>>) => {
        const doc = { ...docs[0], _id: new Types.ObjectId() };
        return Promise.resolve([{ ...doc, toObject: () => doc }]);
      }),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    ingredientsService = {
      resolveQuantity: jest.fn((id: string, quantity: number) =>
        Promise.resolve(
          id === salmonId
            ? resolved(id, quantity, kg, 440)
            : resolved(id, quantity, bag),
        ),
      ),
      update: jest.fn().mockResolvedValue({}),
    };
    inventoryService = {
      withTransaction: jest.fn((fn: (s: unknown) => Promise<unknown>) =>
        fn(session),
      ),
      increment: jest.fn().mockResolvedValue({}),
      decrement: jest.fn().mockResolvedValue({}),
    };
    const module = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: getModelToken(ProductionBatch.name), useValue: batchModel },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: InventoryService, useValue: inventoryService },
        {
          provide: AuditLogsService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = module.get(ProductionService);
  });

  it('takes the raw ingredient out, puts portions in, and splits cost by weight', async () => {
    const batch = await service.create(
      {
        zoneId,
        inputIngredientId: salmonId,
        inputQuantity: 4.9,
        outputs: [
          { ingredientId: dongId, quantity: 10, portionWeight: 100 },
          { ingredientId: sashimiId, quantity: 9, portionWeight: 165 },
        ],
        wasteQuantity: 1.8,
        updateDefaultCost: true,
      },
      owner,
    );

    expect(inventoryService.decrement).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientId: salmonId,
        quantity: 4.9,
        movementType: 'PRODUCTION_OUT',
        referenceType: 'PRODUCTION',
      }),
      session,
    );
    expect(inventoryService.increment).toHaveBeenCalledTimes(2);
    expect(inventoryService.increment).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientId: dongId,
        quantity: 10,
        movementType: 'PRODUCTION_IN',
      }),
      session,
    );
    expect(batch.totalCost).toBe(2156);
    const outputTotal = batch.outputs.reduce((sum, o) => sum + o.totalCost, 0);
    expect(outputTotal).toBeCloseTo(2156, 0);
    // 1000 g + 1485 g out of 4900 g raw
    expect(batch.yieldPercent).toBeCloseTo(50.71, 1);
    expect(ingredientsService.update).toHaveBeenCalledTimes(2);
  });

  it('refuses to overwrite standard costs without ingredients.update', async () => {
    await expect(
      service.create(
        {
          zoneId,
          inputIngredientId: salmonId,
          inputQuantity: 1,
          outputs: [{ ingredientId: dongId, quantity: 1 }],
          updateDefaultCost: true,
        },
        { id: userId, permissions: ['production.create'] },
      ),
    ).rejects.toThrow('ไม่มีสิทธิ์แก้ไขต้นทุนมาตรฐาน');
    expect(inventoryService.decrement).not.toHaveBeenCalled();
  });

  it('rejects producing the raw ingredient from itself', async () => {
    await expect(
      service.create(
        {
          zoneId,
          inputIngredientId: salmonId,
          inputQuantity: 1,
          outputs: [{ ingredientId: salmonId, quantity: 1 }],
        },
        owner,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(inventoryService.decrement).not.toHaveBeenCalled();
  });
});
