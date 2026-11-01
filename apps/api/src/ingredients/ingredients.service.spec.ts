import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Unit } from '../units/schemas/unit.schema';
import { IngredientsService } from './ingredients.service';
import { Ingredient } from './schemas/ingredient.schema';

describe('IngredientsService', () => {
  let service: IngredientsService;
  const bottle = {
    _id: new Types.ObjectId(),
    code: 'BOTTLE',
    name: 'ขวด',
    type: 'COUNT',
    conversionFactor: 1,
  };
  const caseUnit = {
    _id: new Types.ObjectId(),
    code: 'CASE',
    name: 'ลัง',
    type: 'COUNT',
    conversionFactor: 1,
  };
  const packUnit = {
    _id: new Types.ObjectId(),
    code: 'PACK',
    name: 'แพ็ค',
    type: 'COUNT',
    conversionFactor: 1,
  };
  const ingredient = {
    _id: new Types.ObjectId(),
    name: 'เบียร์สิงห์',
    defaultCost: 50,
    baseUnitId: bottle,
    unitConversions: [{ unitId: caseUnit._id, factor: 12 }],
  };
  const ingredientModel = {
    findById: jest.fn(() => ({
      populate: () => ({ lean: () => Promise.resolve(ingredient) }),
    })),
  };
  const unitModel = {
    findById: jest.fn((id: Types.ObjectId | string) => ({
      lean: () =>
        Promise.resolve(
          [bottle, caseUnit, packUnit].find(
            (unit) => unit._id.toString() === id.toString(),
          ) ?? null,
        ),
    })),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: getModelToken(Ingredient.name), useValue: ingredientModel },
        { provide: getModelToken(Unit.name), useValue: unitModel },
      ],
    }).compile();
    service = module.get(IngredientsService);
  });

  describe('resolveQuantity', () => {
    it('keeps base-unit quantities as-is', async () => {
      const resolved = await service.resolveQuantity(
        ingredient._id.toString(),
        5,
      );
      expect(resolved).toMatchObject({
        baseQuantity: 5,
        baseUnit: 'BOTTLE',
        factor: 1,
        inputUnit: 'BOTTLE',
      });
    });

    it('converts a configured pack unit to the base unit', async () => {
      const resolved = await service.resolveQuantity(
        ingredient._id.toString(),
        2.5,
        caseUnit._id.toString(),
      );
      expect(resolved).toMatchObject({
        baseQuantity: 30,
        factor: 12,
        inputQuantity: 2.5,
        inputUnit: 'CASE',
      });
    });

    it('rejects a unit the ingredient has no conversion for', async () => {
      await expect(
        service.resolveQuantity(
          ingredient._id.toString(),
          1,
          packUnit._id.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
