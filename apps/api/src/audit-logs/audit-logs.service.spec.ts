import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from './schemas/audit-log.schema';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let auditLogModel: { create: jest.Mock; find: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    auditLogModel = {
      create: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: getModelToken(AuditLog.name), useValue: auditLogModel },
      ],
    }).compile();

    service = module.get(AuditLogsService);
  });

  describe('log', () => {
    it('writes an audit log entry with the given fields', async () => {
      await service.log({
        userId,
        action: 'WASTE_CREATED',
        entity: 'Waste',
        entityId: 'w-1',
        after: { code: 'WS-1' },
      });

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: 'WASTE_CREATED',
          entity: 'Waste',
          entityId: 'w-1',
          before: null,
          after: { code: 'WS-1' },
          remark: null,
        }),
      );
    });

    it('swallows write failures instead of throwing', async () => {
      auditLogModel.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.log({ userId, action: 'USER_CREATED', entity: 'User' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('applies userId/entity/action filters', () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      auditLogModel.find.mockReturnValue(chain);

      void service.findAll({ userId, entity: 'User', action: 'USER_CREATED' });

      expect(auditLogModel.find).toHaveBeenCalledWith({
        userId,
        entity: 'User',
        action: 'USER_CREATED',
      });
    });
  });
});
