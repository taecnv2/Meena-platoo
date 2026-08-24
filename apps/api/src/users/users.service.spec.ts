import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

/** Chainable query mock: .select()/.populate() return itself, terminal .lean() resolves. */
function queryMock<T>(result: T) {
  const q: { select: jest.Mock; populate: jest.Mock; lean: jest.Mock } = {
    select: jest.fn(() => q),
    populate: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return q;
}

describe('UsersService', () => {
  let service: UsersService;
  let userModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };
  let configService: { get: jest.Mock };

  const roleId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  beforeEach(async () => {
    jest.clearAllMocks();
    userModel = {
      findOne: jest.fn(() => queryMock(null)),
      findById: jest.fn(() => queryMock(null)),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(() => queryMock(null)),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    configService = { get: jest.fn().mockReturnValue(10) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findAuthContextById', () => {
    it('maps the populated role onto AuthContext, deriving isSuperScope from allZoneAccess', async () => {
      const zoneId = new Types.ObjectId();
      userModel.findById.mockReturnValueOnce(
        queryMock({
          _id: userId,
          username: 'somchai',
          status: 'ACTIVE',
          zoneIds: [zoneId],
          roleId: {
            _id: roleId,
            name: 'KITCHEN_STAFF',
            permissions: ['requisition.create'],
            allZoneAccess: false,
          },
        }),
      );

      const context = await service.findAuthContextById(userId.toString());

      expect(context).toEqual({
        id: userId.toString(),
        username: 'somchai',
        roleId: roleId.toString(),
        roleName: 'KITCHEN_STAFF',
        permissions: ['requisition.create'],
        zoneIds: [zoneId.toString()],
        isSuperScope: false,
        status: 'ACTIVE',
      });
    });

    it('returns null when the user does not exist', async () => {
      userModel.findById.mockReturnValueOnce(queryMock(null));

      await expect(
        service.findAuthContextById(userId.toString()),
      ).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('rejects a duplicate username or email (case-insensitively)', async () => {
      userModel.findOne.mockReturnValueOnce(queryMock({ _id: userId }));

      await expect(
        service.create({
          username: 'Somchai',
          email: 'Somchai@Example.com',
          name: 'สมชาย',
          password: 'secret1234',
          roleId: roleId.toString(),
        }),
      ).rejects.toThrow(ConflictException);
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('lowercases username/email, hashes the password with the configured salt rounds, and defaults status/zoneIds', async () => {
      userModel.create.mockResolvedValueOnce({
        _id: userId,
        username: 'somchai',
        email: 'somchai@example.com',
        name: 'สมชาย',
        roleId,
        zoneIds: [],
        status: 'ACTIVE',
        lastLoginAt: null,
      });

      const result = await service.create({
        username: 'Somchai',
        email: 'Somchai@Example.com',
        name: 'สมชาย',
        password: 'secret1234',
        roleId: roleId.toString(),
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret1234', 10);
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'somchai',
          email: 'somchai@example.com',
          passwordHash: 'hashed-password',
          zoneIds: [],
          status: 'ACTIVE',
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('setStatus', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      userModel.findByIdAndUpdate.mockReturnValueOnce(queryMock(null));

      await expect(
        service.setStatus(userId.toString(), 'INACTIVE'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the status and returns the updated user', async () => {
      userModel.findByIdAndUpdate.mockReturnValueOnce(
        queryMock({ _id: userId, status: 'INACTIVE' }),
      );

      const result = await service.setStatus(userId.toString(), 'INACTIVE');

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId.toString(),
        { status: 'INACTIVE' },
        expect.objectContaining({ returnDocument: 'after' }),
      );
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('resetPassword', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      userModel.findByIdAndUpdate.mockReturnValueOnce(queryMock(null));

      await expect(
        service.resetPassword(userId.toString(), 'newpass123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('hashes the new password and updates the user', async () => {
      userModel.findByIdAndUpdate.mockReturnValueOnce(
        queryMock({ _id: userId }),
      );

      await service.resetPassword(userId.toString(), 'newpass123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId.toString(),
        {
          passwordHash: 'hashed-password',
        },
      );
    });
  });
});
