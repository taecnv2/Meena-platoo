import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Category } from '../categories/schemas/category.schema';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { IngredientsService } from '../ingredients/ingredients.service';
import { Ingredient } from '../ingredients/schemas/ingredient.schema';
import { InventoryService } from '../inventory/inventory.service';
import { ZoneStock } from '../inventory/schemas/zone-stock.schema';
import { Unit } from '../units/schemas/unit.schema';
import { Zone } from '../zones/schemas/zone.schema';
import { ImportsService } from './imports.service';

const lean = <T>(value: T) => ({ lean: () => Promise.resolve(value) });

describe('ImportsService', () => {
  let service: ImportsService;
  const kg = { _id: new Types.ObjectId(), code: 'KG', name: 'กิโลกรัม' };
  const fresh = { _id: new Types.ObjectId(), code: 'FRESH', name: 'ของสด' };
  const coldRoom = {
    _id: new Types.ObjectId(),
    code: 'COLD_ROOM',
    name: 'Cold Room',
    description: 'ห้องเย็น',
  };
  const existing = {
    _id: new Types.ObjectId(),
    code: 'ING-0001',
    name: 'หมึกไข่',
    baseUnitId: kg._id,
    unitConversions: [],
  };

  let ingredientsService: { create: jest.Mock; update: jest.Mock };
  let inventoryService: { withTransaction: jest.Mock; setBalance: jest.Mock };
  let categoryModel: { find: jest.Mock; create: jest.Mock; exists: jest.Mock };
  let unitModel: { find: jest.Mock; create: jest.Mock; exists: jest.Mock };

  const owner: RequestUser = {
    id: new Types.ObjectId().toString(),
    username: 'owner',
    roleId: 'r',
    roleName: 'OWNER',
    permissions: Object.values(PERMISSION_CODES),
    zoneIds: [],
    isSuperScope: true,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    categoryModel = {
      find: jest.fn(() => lean([fresh])),
      create: jest.fn(({ code, name }: { code: string; name: string }) =>
        Promise.resolve({ _id: new Types.ObjectId(), code, name }),
      ),
      exists: jest.fn().mockResolvedValue(null),
    };
    unitModel = {
      find: jest.fn(() => lean([kg])),
      create: jest.fn(({ code, name }: { code: string; name: string }) =>
        Promise.resolve({ _id: new Types.ObjectId(), code, name }),
      ),
      exists: jest.fn().mockResolvedValue(null),
    };
    ingredientsService = {
      create: jest.fn((dto: Record<string, unknown>) =>
        Promise.resolve({ ...dto, _id: new Types.ObjectId(), defaultCost: 0 }),
      ),
      update: jest.fn((id: string, dto: Record<string, unknown>) =>
        Promise.resolve({ ...existing, ...dto, defaultCost: 0 }),
      ),
    };
    inventoryService = {
      withTransaction: jest.fn((fn: (s: unknown) => Promise<unknown>) =>
        fn({}),
      ),
      setBalance: jest.fn().mockResolvedValue(null),
    };
    const module = await Test.createTestingModule({
      providers: [
        ImportsService,
        {
          provide: getModelToken(Ingredient.name),
          useValue: {
            find: jest.fn(() => ({ lean: () => Promise.resolve([existing]) })),
            countDocuments: jest.fn().mockResolvedValue(1),
          },
        },
        { provide: getModelToken(Category.name), useValue: categoryModel },
        { provide: getModelToken(Unit.name), useValue: unitModel },
        {
          provide: getModelToken(Zone.name),
          useValue: { find: jest.fn(() => lean([coldRoom])) },
        },
        {
          provide: getModelToken(ZoneStock.name),
          useValue: {
            find: jest.fn(() =>
              lean([
                {
                  ingredientId: existing._id,
                  zoneId: coldRoom._id,
                  quantity: 70,
                },
              ]),
            ),
          },
        },
        { provide: IngredientsService, useValue: ingredientsService },
        { provide: InventoryService, useValue: inventoryService },
        {
          provide: AuditLogsService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = module.get(ImportsService);
  });

  const rows = [
    {
      name: 'หมึกไข่',
      category: 'ของสด',
      baseUnit: 'kg',
      zone: 'ห้องเย็น',
      openingQuantity: 90,
    },
    {
      name: 'เบียร์สิงห์',
      category: 'เครื่องดื่ม',
      baseUnit: 'ขวด',
      packUnit: 'ลัง',
      packFactor: 12,
    },
    { name: 'ไม่มีหน่วย', category: 'ของสด', baseUnit: '' },
    { name: 'เบียร์สิงห์', category: 'เครื่องดื่ม', baseUnit: 'ขวด' },
  ];

  it('previews without writing anything on a dry run', async () => {
    const result = await service.importIngredients(
      { rows, dryRun: true },
      owner,
    );

    expect(result.rows.map((row) => row.action)).toEqual([
      'UPDATE',
      'CREATE',
      'ERROR',
      'ERROR',
    ]);
    expect(result.rows[3].messages[0]).toContain('ซ้ำกับแถวที่ 3');
    expect(result.summary.newCategories).toEqual(['เครื่องดื่ม']);
    expect(result.summary.newUnits).toEqual(['ขวด', 'ลัง']);
    expect(result.summary.openingBalances).toBe(1);
    expect(result.rows[0].messages).toContain(
      '⚠ ยอดที่ Cold Room ปัจจุบัน 70 จะถูกตั้งเป็น 90 (+20)',
    );
    expect(ingredientsService.create).not.toHaveBeenCalled();
    expect(categoryModel.create).not.toHaveBeenCalled();
    expect(inventoryService.setBalance).not.toHaveBeenCalled();
  });

  it('creates missing master data, upserts ingredients and sets opening balances', async () => {
    const result = await service.importIngredients(
      { rows, dryRun: false },
      owner,
    );

    expect(categoryModel.create).toHaveBeenCalledTimes(1);
    expect(unitModel.create).toHaveBeenCalledTimes(2);
    expect(ingredientsService.update).toHaveBeenCalledWith(
      existing._id.toString(),
      expect.objectContaining({ name: 'หมึกไข่' }),
    );
    expect(ingredientsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'เบียร์สิงห์',
        code: 'ING-0002',
        unitConversions: [expect.objectContaining({ factor: 12 })],
      }),
    );
    expect(inventoryService.setBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        zoneId: coldRoom._id.toString(),
        target: 90,
        referenceType: 'IMPORT',
      }),
      expect.anything(),
    );
    expect(result.summary).toMatchObject({ create: 1, update: 1, error: 2 });
  });

  it('rejects changing an existing base unit, even to a unit that does not exist yet', async () => {
    const result = await service.importIngredients(
      {
        rows: [{ name: 'หมึกไข่', category: 'ของสด', baseUnit: 'แพ็ค6' }],
        dryRun: true,
      },
      owner,
    );
    expect(result.rows[0].action).toBe('ERROR');
    expect(result.rows[0].messages[0]).toContain('หน่วยหลักไม่ตรงกับของเดิม');
  });

  it('rejects a pack unit that resolves to the base unit under another spelling', async () => {
    const result = await service.importIngredients(
      {
        rows: [
          {
            name: 'ใหม่',
            category: 'ของสด',
            baseUnit: 'KG',
            packUnit: 'กิโลกรัม',
            packFactor: 2,
            rowNumber: 7,
          },
        ],
        dryRun: true,
      },
      owner,
    );
    expect(result.rows[0]).toMatchObject({ action: 'ERROR', rowNumber: 7 });
    expect(result.rows[0].messages).toContain(
      'หน่วยแพ็คต้องไม่ซ้ำกับหน่วยหลัก',
    );
  });

  it('refuses opening balances for zones outside the user scope', async () => {
    const result = await service.importIngredients(
      { rows: [rows[0]], dryRun: true },
      { ...owner, isSuperScope: false, zoneIds: [] },
    );
    expect(result.rows[0].action).toBe('ERROR');
    expect(result.rows[0].messages[0]).toContain('ไม่มีสิทธิ์เข้าถึง Zone');
  });
});
