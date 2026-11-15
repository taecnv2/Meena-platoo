import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { PERMISSION_REGISTRY } from '../common/constants/permissions';
import { ROLE_DEFINITIONS, ROLE_NAMES } from '../common/constants/roles';
import type { AppConfig } from '../config/configuration';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import {
  Ingredient,
  IngredientDocument,
} from '../ingredients/schemas/ingredient.schema';
import {
  Permission,
  PermissionDocument,
} from '../permissions/schemas/permission.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import {
  Supplier,
  SupplierDocument,
} from '../suppliers/schemas/supplier.schema';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Zone, ZoneDocument, ZoneType } from '../zones/schemas/zone.schema';
import { CATEGORY_SEEDS, UNIT_SEEDS } from './seed-data/master-data';
import { MASTER_INGREDIENTS } from './seed-data/master-ingredients';

/** Initial zones (plan.md §20 + the reserved WAREHOUSE). Not hard-coded elsewhere -- users can add more via the Zones UI. */
const ZONE_SEEDS: Array<{
  name: string;
  code: string;
  type: ZoneType;
  description: string;
  allowReceiving?: boolean;
}> = [
  {
    name: 'คลังสินค้า',
    code: 'WAREHOUSE',
    type: 'STORAGE',
    description: 'คลังสินค้ากลาง',
    allowReceiving: true,
  },
  { name: 'Kitchen', code: 'KITCHEN', type: 'KITCHEN', description: 'ครัว' },
  {
    name: 'Front of House',
    code: 'FOH',
    type: 'FRONT_OF_HOUSE',
    description: 'หน้าร้าน',
  },
  {
    name: 'Cold Room',
    code: 'COLD_ROOM',
    type: 'COLD_STORAGE',
    description: 'ห้องเย็น',
    allowReceiving: true,
  },
];

interface SeedContext {
  roleIdByName: Map<string, string>;
  zoneIdByCode: Map<string, string>;
  configService: ConfigService<AppConfig, true>;
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const configService = app.get(ConfigService<AppConfig, true>);

  const permissionModel = app.get<Model<PermissionDocument>>(
    getModelToken(Permission.name),
  );
  const roleModel = app.get<Model<RoleDocument>>(getModelToken(Role.name));
  const zoneModel = app.get<Model<ZoneDocument>>(getModelToken(Zone.name));
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  console.log('Seeding permissions...');
  for (const permission of PERMISSION_REGISTRY) {
    await permissionModel.updateOne(
      { code: permission.code },
      {
        $set: {
          name: permission.name,
          module: permission.module,
          description: permission.description,
          status: 'ACTIVE',
        },
      },
      { upsert: true },
    );
  }
  console.log(`  ${PERMISSION_REGISTRY.length} permissions upserted.`);

  console.log('Seeding roles...');
  const roleIdByName = new Map<string, string>();
  for (const role of ROLE_DEFINITIONS) {
    const updated = await roleModel.findOneAndUpdate(
      { name: role.name },
      {
        $set: {
          description: role.description,
          permissions: role.permissions,
          allZoneAccess: role.allZoneAccess,
          status: 'ACTIVE',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    roleIdByName.set(role.name, updated._id.toString());
  }
  console.log(`  ${ROLE_DEFINITIONS.length} roles upserted.`);

  console.log('Seeding zones...');
  const zoneIdByCode = new Map<string, string>();
  for (const zone of ZONE_SEEDS) {
    const updated = await zoneModel.findOneAndUpdate(
      { code: zone.code },
      {
        $set: {
          name: zone.name,
          type: zone.type,
          description: zone.description,
          status: 'ACTIVE',
        },
        $setOnInsert: { allowReceiving: zone.allowReceiving ?? false },
      },
      { upsert: true, returnDocument: 'after' },
    );
    // Zones created before allowReceiving existed: enable it once for the default receiving zones.
    if (zone.allowReceiving) {
      await zoneModel.updateOne(
        { code: zone.code, allowReceiving: { $exists: false } },
        { $set: { allowReceiving: true } },
      );
    }
    zoneIdByCode.set(zone.code, updated._id.toString());
  }
  console.log(`  ${ZONE_SEEDS.length} zones upserted.`);

  console.log('Seeding master categories and units...');
  const categoryModel = app.get<Model<CategoryDocument>>(
    getModelToken(Category.name),
  );
  const unitModel = app.get<Model<UnitDocument>>(getModelToken(Unit.name));
  const categoryIdByCode = await ensureByCodeOrName(
    categoryModel,
    CATEGORY_SEEDS.map((category) => ({
      code: category.code,
      name: category.name,
      description: '',
    })),
  );
  const unitIdByCode = await ensureByCodeOrName(
    unitModel,
    UNIT_SEEDS.map((unit) => ({ ...unit })),
  );
  console.log(
    `  ${CATEGORY_SEEDS.length} categories and ${UNIT_SEEDS.length} units ensured.`,
  );

  console.log('Seeding master ingredients...');
  const ingredientModel = app.get<Model<IngredientDocument>>(
    getModelToken(Ingredient.name),
  );
  await seedMasterIngredients(ingredientModel, categoryIdByCode, unitIdByCode);
  if (configService.get('seed.replaceIngredients', { infer: true })) {
    await deactivateUnlistedIngredients(ingredientModel);
  }

  console.log('Seeding owner user...');
  const ownerRoleId = roleIdByName.get(ROLE_NAMES.OWNER);
  if (!ownerRoleId) {
    throw new Error('OWNER role missing after seed');
  }
  const ownerUsername = configService
    .get('seed.ownerUsername', { infer: true })
    .toLowerCase();
  const existingOwner = await userModel
    .findOne({ username: ownerUsername })
    .lean();
  if (existingOwner) {
    console.log(
      `  Owner user "${ownerUsername}" already exists -- leaving password untouched.`,
    );
  } else {
    const passwordHash = await bcrypt.hash(
      configService.get('seed.ownerPassword', { infer: true }),
      configService.get('bcryptSaltRounds', { infer: true }),
    );
    await userModel.create({
      username: ownerUsername,
      email: configService
        .get('seed.ownerEmail', { infer: true })
        .toLowerCase(),
      name: 'Owner',
      passwordHash,
      roleId: ownerRoleId,
      zoneIds: [],
      status: 'ACTIVE',
    });
    console.log(`  Owner user "${ownerUsername}" created.`);
  }

  if (configService.get('seed.demoData', { infer: true })) {
    await seedDemoData(app, { roleIdByName, zoneIdByCode, configService });
  }

  await app.close();
  console.log('Seed complete.');
}

async function seedDemoData(
  app: INestApplicationContext,
  ctx: SeedContext,
): Promise<void> {
  console.log('Seeding demo data (SEED_DEMO_DATA=true)...');
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const categoryModel = app.get<Model<CategoryDocument>>(
    getModelToken(Category.name),
  );
  const unitModel = app.get<Model<UnitDocument>>(getModelToken(Unit.name));
  const supplierModel = app.get<Model<SupplierDocument>>(
    getModelToken(Supplier.name),
  );
  const ingredientModel = app.get<Model<IngredientDocument>>(
    getModelToken(Ingredient.name),
  );

  const demoPassword = 'Demo1234!';
  const passwordHash = await bcrypt.hash(
    demoPassword,
    ctx.configService.get('bcryptSaltRounds', { infer: true }),
  );

  const warehouseZoneId = requireZoneId(ctx.zoneIdByCode, 'WAREHOUSE');
  const kitchenZoneId = requireZoneId(ctx.zoneIdByCode, 'KITCHEN');
  const fohZoneId = requireZoneId(ctx.zoneIdByCode, 'FOH');
  const coldRoomZoneId = requireZoneId(ctx.zoneIdByCode, 'COLD_ROOM');

  const demoUsers = [
    {
      username: 'manager',
      email: 'manager@meenaplatoo.local',
      name: 'Demo Manager',
      roleName: ROLE_NAMES.MANAGER,
      zoneIds: [warehouseZoneId, kitchenZoneId, fohZoneId, coldRoomZoneId],
    },
    {
      username: 'inventory',
      email: 'inventory@meenaplatoo.local',
      name: 'Demo Inventory Manager',
      roleName: ROLE_NAMES.INVENTORY_MANAGER,
      zoneIds: [warehouseZoneId, kitchenZoneId, fohZoneId, coldRoomZoneId],
    },
    {
      username: 'kitchen',
      email: 'kitchen@meenaplatoo.local',
      name: 'Demo Kitchen Staff',
      roleName: ROLE_NAMES.KITCHEN_STAFF,
      zoneIds: [kitchenZoneId],
    },
    {
      username: 'front',
      email: 'front@meenaplatoo.local',
      name: 'Demo Front Staff',
      roleName: ROLE_NAMES.FRONT_STAFF,
      zoneIds: [fohZoneId],
    },
  ];

  let createdCount = 0;
  for (const demoUser of demoUsers) {
    const roleId = ctx.roleIdByName.get(demoUser.roleName);
    if (!roleId) {
      continue;
    }
    const existing = await userModel
      .findOne({ username: demoUser.username })
      .lean();
    if (existing) {
      continue;
    }
    await userModel.create({
      username: demoUser.username,
      email: demoUser.email,
      name: demoUser.name,
      passwordHash,
      roleId,
      zoneIds: demoUser.zoneIds,
      status: 'ACTIVE',
    });
    createdCount += 1;
  }
  console.log(
    `  ${createdCount} demo user(s) created (password: ${demoPassword}).`,
  );

  const category = await categoryModel.findOneAndUpdate(
    { code: 'SEAFOOD' },
    { $set: { name: 'อาหารทะเล', description: 'Seafood', status: 'ACTIVE' } },
    { upsert: true, returnDocument: 'after' },
  );
  const unit = await unitModel.findOneAndUpdate(
    { code: 'KG' },
    {
      $set: {
        name: 'กิโลกรัม',
        type: 'WEIGHT',
        conversionFactor: 1,
        status: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  await supplierModel.findOneAndUpdate(
    { code: 'SUP001' },
    {
      $set: {
        name: 'ตลาดทะเลสด',
        contactName: 'คุณสมชาย',
        phone: '081-234-5678',
        status: 'ACTIVE',
      },
    },
    { upsert: true },
  );
  await ingredientModel.findOneAndUpdate(
    { code: 'PLATOO' },
    {
      $set: {
        name: 'ปลาทู',
        categoryId: category._id,
        baseUnitId: unit._id,
        minimumStock: 5,
        maximumStock: 50,
        defaultCost: 120,
        status: 'ACTIVE',
      },
    },
    { upsert: true },
  );
  console.log('  Demo category/unit/supplier/ingredient ensured (ปลาทู).');
}

/** Normalized name used to match seed rows against records typed in the UI or imported. */
function nameKey(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * Inserts each seed row unless a record with the same code -- or the same name, e.g. "ห่อ"
 * created on the fly by the importer under another code -- already exists. Existing records are
 * never modified. Returns seed code -> id of whichever record now represents it.
 */
async function ensureByCodeOrName<T extends { code: string; name: string }>(
  model: Model<CategoryDocument> | Model<UnitDocument>,
  rows: T[],
): Promise<Map<string, Types.ObjectId>> {
  const existing = await (model as Model<CategoryDocument>)
    .find({}, { code: 1, name: 1 })
    .lean();
  const idByCode = new Map(existing.map((doc) => [doc.code, doc._id]));
  const idByName = new Map(existing.map((doc) => [nameKey(doc.name), doc._id]));
  const result = new Map<string, Types.ObjectId>();
  for (const row of rows) {
    let id = idByCode.get(row.code) ?? idByName.get(nameKey(row.name));
    if (!id) {
      const created = await (model as Model<CategoryDocument>).create({
        ...row,
        status: 'ACTIVE',
      });
      id = created._id;
    }
    result.set(row.code, id);
  }
  return result;
}

/** Adds the master list; an ingredient whose code or name already exists is left exactly as it is. */
async function seedMasterIngredients(
  ingredientModel: Model<IngredientDocument>,
  categoryIdByCode: Map<string, Types.ObjectId>,
  unitIdByCode: Map<string, Types.ObjectId>,
): Promise<void> {
  const existing = await ingredientModel.find({}, { code: 1, name: 1 }).lean();
  const codes = new Set(existing.map((doc) => doc.code));
  const names = new Set(existing.map((doc) => nameKey(doc.name)));
  const requireId = (map: Map<string, Types.ObjectId>, code: string) => {
    const id = map.get(code);
    if (!id) {
      throw new Error(`Master data code "${code}" was not seeded`);
    }
    return id;
  };

  let created = 0;
  for (const item of MASTER_INGREDIENTS) {
    if (codes.has(item.code) || names.has(nameKey(item.name))) {
      continue;
    }
    await ingredientModel.create({
      code: item.code,
      name: item.name,
      categoryId: requireId(categoryIdByCode, item.category),
      baseUnitId: requireId(unitIdByCode, item.unit),
      unitConversions: (item.packs ?? []).map((pack) => ({
        unitId: requireId(unitIdByCode, pack.unit),
        factor: pack.factor,
      })),
      tags: item.tags,
      consignmentOwner: item.consignmentOwner ?? null,
      defaultCost: item.defaultCost ?? 0,
      description: item.description ?? '',
      status: 'ACTIVE',
    });
    created += 1;
  }
  console.log(
    `  ${created} new, ${MASTER_INGREDIENTS.length - created} already present (${MASTER_INGREDIENTS.length} in master list).`,
  );
}

/**
 * SEED_REPLACE_INGREDIENTS=true: hides every ingredient that is not in the master list by setting
 * it INACTIVE. Nothing is deleted, so stock history and old reports stay intact and an item can be
 * re-activated from the Ingredients page.
 */
async function deactivateUnlistedIngredients(
  ingredientModel: Model<IngredientDocument>,
): Promise<void> {
  const masterCodes = new Set(MASTER_INGREDIENTS.map((item) => item.code));
  const masterNames = new Set(
    MASTER_INGREDIENTS.map((item) => nameKey(item.name)),
  );
  const active = await ingredientModel
    .find({ status: 'ACTIVE' }, { code: 1, name: 1 })
    .lean();
  const unlistedIds = active
    .filter(
      (doc) =>
        !masterCodes.has(doc.code) && !masterNames.has(nameKey(doc.name)),
    )
    .map((doc) => doc._id);
  if (unlistedIds.length > 0) {
    await ingredientModel.updateMany(
      { _id: { $in: unlistedIds } },
      { $set: { status: 'INACTIVE' } },
    );
  }
  console.log(
    `  SEED_REPLACE_INGREDIENTS: ${unlistedIds.length} ingredient(s) not in the master list set to INACTIVE.`,
  );
}

function requireZoneId(
  zoneIdByCode: Map<string, string>,
  code: string,
): string {
  const zoneId = zoneIdByCode.get(code);
  if (!zoneId) {
    throw new Error(`Zone "${code}" was not seeded`);
  }
  return zoneId;
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
