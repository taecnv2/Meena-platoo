import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { ZonesService } from '../zones/zones.service';
import { InventoryService } from './inventory.service';
import { ZoneStock } from './schemas/zone-stock.schema';

describe('InventoryService', () => {
  let service: InventoryService;
  let zoneStockModel: { findOneAndUpdate: jest.Mock };
  let stockMovementsService: { record: jest.Mock };
  let ingredientsService: { findByIdWithUnit: jest.Mock };
  let zonesService: { getWarehouseZoneId: jest.Mock };
  let auditLogsService: { log: jest.Mock };
  let sessionMock: { withTransaction: jest.Mock; endSession: jest.Mock };
  let connectionMock: { startSession: jest.Mock };

  const ingredientId = new Types.ObjectId().toString();
  const zoneId = new Types.ObjectId().toString();
  const warehouseZoneId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    zoneStockModel = { findOneAndUpdate: jest.fn() };
    stockMovementsService = {
      record: jest
        .fn()
        .mockImplementation((input) =>
          Promise.resolve({ ...input, _id: new Types.ObjectId() }),
        ),
    };
    ingredientsService = {
      findByIdWithUnit: jest.fn().mockResolvedValue({
        _id: ingredientId,
        defaultCost: 30,
        baseUnitId: { code: 'kg' },
      }),
    };
    zonesService = {
      getWarehouseZoneId: jest.fn().mockResolvedValue(warehouseZoneId),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };
    sessionMock = {
      withTransaction: jest.fn(async (fn: () => Promise<void>) => {
        await fn();
      }),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    connectionMock = { startSession: jest.fn().mockResolvedValue(sessionMock) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getModelToken(ZoneStock.name), useValue: zoneStockModel },
        { provide: getConnectionToken(), useValue: connectionMock },
        { provide: StockMovementsService, useValue: stockMovementsService },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: ZonesService, useValue: zonesService },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('increment', () => {
    it('upserts ZoneStock with $inc and records a movement with the rounded totalCost', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue({ quantity: 10 });

      await service.increment(
        {
          ingredientId,
          zoneId,
          quantity: 3,
          unit: 'kg',
          movementType: 'STOCK_IN',
          referenceType: 'STOCK_IN',
          referenceId: null,
          unitCost: 10.005,
          performedBy: userId,
        },
        {} as never,
      );

      expect(zoneStockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { ingredientId, zoneId },
        { $inc: { quantity: 3 } },
        expect.objectContaining({ upsert: true }),
      );
      expect(stockMovementsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ totalCost: 30.02 }),
        {},
      );
    });
  });

  describe('decrement', () => {
    it('decreases stock and records a movement when enough stock is available', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue({ quantity: 7 });

      await service.decrement(
        {
          ingredientId,
          zoneId,
          quantity: 3,
          unit: 'kg',
          movementType: 'STOCK_OUT',
          referenceType: 'STOCK_OUT',
          referenceId: null,
          unitCost: 30,
          performedBy: userId,
        },
        {} as never,
      );

      expect(zoneStockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { ingredientId, zoneId, quantity: { $gte: 3 } },
        { $inc: { quantity: -3 } },
        expect.objectContaining({ returnDocument: 'after' }),
      );
      expect(stockMovementsService.record).toHaveBeenCalled();
    });

    it('throws ConflictException and writes no movement when stock is insufficient', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.decrement(
          {
            ingredientId,
            zoneId,
            quantity: 100,
            unit: 'kg',
            movementType: 'STOCK_OUT',
            referenceType: 'STOCK_OUT',
            referenceId: null,
            unitCost: 30,
            performedBy: userId,
          },
          {} as never,
        ),
      ).rejects.toThrow(ConflictException);
      expect(stockMovementsService.record).not.toHaveBeenCalled();
    });
  });

  describe('stockIn', () => {
    it('rejects when the target zone is not the reserved WAREHOUSE zone', async () => {
      await expect(
        service.stockIn({ ingredientId, zoneId, quantity: 5 }, userId),
      ).rejects.toThrow(BadRequestException);
      expect(zoneStockModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('falls back to the ingredient defaultCost when no unitCost is given', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue({ quantity: 5 });

      await service.stockIn(
        { ingredientId, zoneId: warehouseZoneId, quantity: 5 },
        userId,
      );

      expect(stockMovementsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ unitCost: 30, totalCost: 150 }),
        sessionMock,
      );
    });
  });

  describe('stockOut', () => {
    it('decrements stock using the ingredient defaultCost', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue({ quantity: 2 });

      await service.stockOut({ ingredientId, zoneId, quantity: 2 }, userId);

      expect(zoneStockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { ingredientId, zoneId, quantity: { $gte: 2 } },
        { $inc: { quantity: -2 } },
        expect.objectContaining({ returnDocument: 'after' }),
      );
    });
  });

  describe('adjust', () => {
    it('rejects a zero quantityDelta', async () => {
      await expect(
        service.adjust(
          {
            ingredientId,
            zoneId,
            quantityDelta: 0,
            reason: 'นับใหม่',
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('increments stock for a positive delta and writes an audit log', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue({ quantity: 12 });

      await service.adjust(
        { ingredientId, zoneId, quantityDelta: 5, reason: 'นับใหม่' },
        userId,
      );

      expect(zoneStockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { ingredientId, zoneId },
        { $inc: { quantity: 5 } },
        expect.objectContaining({ upsert: true }),
      );
      expect(stockMovementsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: 'ADJUSTMENT_IN' }),
        sessionMock,
      );
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_ADJUSTED', userId }),
      );
    });

    it('decrements stock using the absolute value for a negative delta', async () => {
      zoneStockModel.findOneAndUpdate.mockResolvedValue({ quantity: 7 });

      await service.adjust(
        { ingredientId, zoneId, quantityDelta: -4, reason: 'ของหาย' },
        userId,
      );

      expect(zoneStockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { ingredientId, zoneId, quantity: { $gte: 4 } },
        { $inc: { quantity: -4 } },
        expect.objectContaining({ returnDocument: 'after' }),
      );
      expect(stockMovementsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ADJUSTMENT_OUT',
          quantity: 4,
        }),
        sessionMock,
      );
    });
  });

  describe('withTransaction', () => {
    it('always ends the session, even when the callback throws', async () => {
      await expect(
        service.withTransaction(() => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(connectionMock.startSession).toHaveBeenCalled();
      expect(sessionMock.endSession).toHaveBeenCalled();
    });
  });
});
