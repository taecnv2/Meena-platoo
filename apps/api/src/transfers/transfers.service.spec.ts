import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { TransfersService } from './transfers.service';
import { Transfer } from './schemas/transfer.schema';

describe('TransfersService', () => {
  let service: TransfersService;
  let transferModel: { create: jest.Mock };
  let inventoryService: {
    withTransaction: jest.Mock;
    decrement: jest.Mock;
    increment: jest.Mock;
  };
  let ingredientsService: { findByIdWithUnit: jest.Mock };
  let auditLogsService: { log: jest.Mock };

  const fromZoneId = new Types.ObjectId().toString();
  const toZoneId = new Types.ObjectId().toString();
  const ingredientId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const transferId = new Types.ObjectId();
  const sessionMock = { id: 'session' };

  beforeEach(async () => {
    transferModel = {
      create: jest.fn().mockResolvedValue([
        {
          _id: transferId,
          fromZoneId,
          toZoneId,
          status: 'PENDING',
          completedAt: null,
          save: jest.fn().mockResolvedValue(undefined),
          toObject: jest.fn().mockImplementation(function (
            this: Record<string, unknown>,
          ) {
            return { ...this };
          }),
        },
      ]),
    };
    inventoryService = {
      withTransaction: jest.fn((fn: (session: unknown) => Promise<unknown>) =>
        fn(sessionMock),
      ),
      decrement: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    ingredientsService = {
      findByIdWithUnit: jest.fn().mockResolvedValue({
        _id: ingredientId,
        defaultCost: 30,
        baseUnitId: { code: 'kg' },
      }),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: getModelToken(Transfer.name), useValue: transferModel },
        { provide: InventoryService, useValue: inventoryService },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get(TransfersService);
  });

  describe('executeTransfer', () => {
    it('decrements the source zone and increments the destination zone for each item, then completes the transfer', async () => {
      const result = await service.executeTransfer({
        fromZoneId,
        toZoneId,
        items: [{ ingredientId, quantity: 5 }],
        requisitionId: null,
        performedBy: userId,
      });

      expect(inventoryService.decrement).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId,
          zoneId: fromZoneId,
          quantity: 5,
          movementType: 'TRANSFER_OUT',
          referenceType: 'TRANSFER',
          referenceId: transferId.toString(),
        }),
        sessionMock,
      );
      expect(inventoryService.increment).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId,
          zoneId: toZoneId,
          quantity: 5,
          movementType: 'TRANSFER_IN',
          referenceType: 'TRANSFER',
          referenceId: transferId.toString(),
        }),
        sessionMock,
      );
      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('decrements before incrementing for each item, in order', async () => {
      const callOrder: string[] = [];
      inventoryService.decrement.mockImplementation(() => {
        callOrder.push('decrement');
        return Promise.resolve(undefined);
      });
      inventoryService.increment.mockImplementation(() => {
        callOrder.push('increment');
        return Promise.resolve(undefined);
      });

      await service.executeTransfer({
        fromZoneId,
        toZoneId,
        items: [{ ingredientId, quantity: 5 }],
        requisitionId: null,
        performedBy: userId,
      });

      expect(callOrder).toEqual(['decrement', 'increment']);
    });

    it('writes an audit log referencing the completed transfer', async () => {
      await service.executeTransfer({
        fromZoneId,
        toZoneId,
        items: [{ ingredientId, quantity: 5 }],
        requisitionId: null,
        performedBy: userId,
      });

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: 'TRANSFER_COMPLETED',
          entity: 'Transfer',
          entityId: transferId.toString(),
        }),
      );
    });
  });

  describe('createDirectTransfer', () => {
    it('delegates to executeTransfer with a null requisitionId', async () => {
      const executeSpy = jest.spyOn(service, 'executeTransfer');

      await service.createDirectTransfer(
        {
          fromZoneId,
          toZoneId,
          items: [{ ingredientId, quantity: 2 }],
        },
        userId,
      );

      expect(executeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fromZoneId,
          toZoneId,
          requisitionId: null,
          performedBy: userId,
        }),
      );
    });
  });
});
