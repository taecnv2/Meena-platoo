import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RolesService } from './roles.service';
import { Role } from './schemas/role.schema';

function queryMock<T>(result: T) {
  return { lean: jest.fn().mockResolvedValue(result) };
}

describe('RolesService', () => {
  let service: RolesService;
  let roleModel: {
    find: jest.Mock;
    findById: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  const roleId = new Types.ObjectId();

  beforeEach(async () => {
    roleModel = {
      find: jest.fn(() => ({ sort: jest.fn(() => queryMock([])) })),
      findById: jest.fn(() => queryMock(null)),
      findOne: jest.fn(() => queryMock(null)),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(() => queryMock(null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getModelToken(Role.name), useValue: roleModel },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  describe('findById', () => {
    it('throws NotFoundException when the role does not exist', async () => {
      await expect(service.findById(roleId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the role when found', async () => {
      roleModel.findById.mockReturnValueOnce(
        queryMock({ _id: roleId, name: 'MANAGER' }),
      );

      await expect(service.findById(roleId.toString())).resolves.toEqual({
        _id: roleId,
        name: 'MANAGER',
      });
    });
  });

  describe('create', () => {
    it('rejects a duplicate role name', async () => {
      roleModel.findOne.mockReturnValueOnce(
        queryMock({ _id: roleId, name: 'MANAGER' }),
      );

      await expect(
        service.create({ name: 'MANAGER', permissions: [] }),
      ).rejects.toThrow(ConflictException);
      expect(roleModel.create).not.toHaveBeenCalled();
    });

    it('creates a new role when the name is unique', async () => {
      const created = {
        toObject: jest
          .fn()
          .mockReturnValue({ _id: roleId, name: 'CASHIER', permissions: [] }),
      };
      roleModel.create.mockResolvedValueOnce(created);

      const result = await service.create({
        name: 'CASHIER',
        permissions: [],
      });

      expect(roleModel.create).toHaveBeenCalledWith({
        name: 'CASHIER',
        permissions: [],
      });
      expect(result).toEqual({ _id: roleId, name: 'CASHIER', permissions: [] });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the role does not exist', async () => {
      await expect(
        service.update(roleId.toString(), {
          permissions: ['reports.read'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates and returns the role when found', async () => {
      roleModel.findByIdAndUpdate.mockReturnValueOnce(
        queryMock({
          _id: roleId,
          name: 'MANAGER',
          permissions: ['reports.read'],
        }),
      );

      const result = await service.update(roleId.toString(), {
        permissions: ['reports.read'],
      });

      expect(roleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        roleId.toString(),
        { permissions: ['reports.read'] },
        expect.objectContaining({ returnDocument: 'after' }),
      );
      expect(result.permissions).toEqual(['reports.read']);
    });
  });
});
