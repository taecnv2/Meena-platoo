import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { WAREHOUSE_ZONE_CODE } from '../common/constants/zones';
import { ZonesService } from './zones.service';
import { Zone } from './schemas/zone.schema';

function queryMock<T>(result: T) {
  return { lean: jest.fn().mockResolvedValue(result) };
}

describe('ZonesService', () => {
  let service: ZonesService;
  let zoneModel: {
    findById: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  const zoneId = new Types.ObjectId();

  beforeEach(async () => {
    zoneModel = {
      findById: jest.fn(() => queryMock(null)),
      findOne: jest.fn(() => queryMock(null)),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(() => queryMock(null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonesService,
        { provide: getModelToken(Zone.name), useValue: zoneModel },
      ],
    }).compile();

    service = module.get(ZonesService);
  });

  describe('create', () => {
    it('rejects a duplicate zone code', async () => {
      zoneModel.findOne.mockReturnValueOnce(
        queryMock({ _id: zoneId, code: 'KITCHEN' }),
      );

      await expect(
        service.create({ code: 'kitchen', name: 'Kitchen' } as never),
      ).rejects.toThrow(ConflictException);
      expect(zoneModel.create).not.toHaveBeenCalled();
    });

    it('uppercases the zone code before creating', async () => {
      const created = {
        toObject: jest
          .fn()
          .mockReturnValue({ _id: zoneId, code: 'FREEZER', name: 'Freezer' }),
      };
      zoneModel.create.mockResolvedValueOnce(created);

      await service.create({ code: 'freezer', name: 'Freezer' } as never);

      expect(zoneModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FREEZER' }),
      );
    });
  });

  describe('setStatus', () => {
    it('blocks disabling the reserved WAREHOUSE zone', async () => {
      zoneModel.findById.mockReturnValueOnce(
        queryMock({
          _id: zoneId,
          code: WAREHOUSE_ZONE_CODE,
          name: 'คลังสินค้าหลัก',
        }),
      );

      await expect(
        service.setStatus(zoneId.toString(), 'INACTIVE'),
      ).rejects.toThrow(BadRequestException);
      expect(zoneModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows disabling a non-reserved zone', async () => {
      zoneModel.findById.mockReturnValueOnce(
        queryMock({ _id: zoneId, code: 'FRONT', name: 'Front of House' }),
      );
      zoneModel.findByIdAndUpdate.mockReturnValueOnce(
        queryMock({ _id: zoneId, status: 'INACTIVE' }),
      );

      const result = await service.setStatus(zoneId.toString(), 'INACTIVE');

      expect(result.status).toBe('INACTIVE');
    });

    it('allows re-enabling any zone, including WAREHOUSE, without the findById guard check', async () => {
      zoneModel.findByIdAndUpdate.mockReturnValueOnce(
        queryMock({ _id: zoneId, status: 'ACTIVE' }),
      );

      const result = await service.setStatus(zoneId.toString(), 'ACTIVE');

      expect(zoneModel.findById).not.toHaveBeenCalled();
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('getWarehouseZoneId', () => {
    it('throws NotFoundException when no WAREHOUSE zone is seeded', async () => {
      await expect(service.getWarehouseZoneId()).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the WAREHOUSE zone id as a string', async () => {
      zoneModel.findOne.mockReturnValueOnce(
        queryMock({ _id: zoneId, code: WAREHOUSE_ZONE_CODE }),
      );

      await expect(service.getWarehouseZoneId()).resolves.toBe(
        zoneId.toString(),
      );
    });
  });
});
