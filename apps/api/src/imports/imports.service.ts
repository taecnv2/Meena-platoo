import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { IngredientsService } from '../ingredients/ingredients.service';
import {
  Ingredient,
  IngredientDocument,
} from '../ingredients/schemas/ingredient.schema';
import { InventoryService } from '../inventory/inventory.service';
import {
  ZoneStock,
  ZoneStockDocument,
} from '../inventory/schemas/zone-stock.schema';
import { Unit, UnitDocument } from '../units/schemas/unit.schema';
import { Zone, ZoneDocument } from '../zones/schemas/zone.schema';
import {
  ImportIngredientRowDto,
  ImportIngredientsDto,
} from './dto/import-ingredients.dto';
import {
  codeFromName,
  guessUnitType,
  normalizeKey,
  splitTags,
} from './import-helpers';

export type ImportRowAction = 'CREATE' | 'UPDATE' | 'ERROR';

export interface ImportRowResult {
  /** Spreadsheet row number (header = row 1). */
  rowNumber: number;
  code: string | null;
  name: string;
  action: ImportRowAction;
  messages: string[];
}

export interface ImportResult {
  dryRun: boolean;
  summary: {
    total: number;
    create: number;
    update: number;
    error: number;
    openingBalances: number;
    newCategories: string[];
    newUnits: string[];
  };
  rows: ImportRowResult[];
}

/** A reference that is either an existing document id or a name still to be created. */
type Ref = { id: string } | { createName: string };

interface PlannedRow {
  result: ImportRowResult;
  row: ImportIngredientRowDto;
  existing: IngredientLean | null;
  category: Ref | null;
  baseUnit: Ref | null;
  packUnit: Ref | null;
  zoneId: string | null;
}

type IngredientLean = Ingredient & { _id: Types.ObjectId };

interface Lookups {
  categories: Map<string, string>;
  units: Map<string, string>;
  zones: Map<string, { id: string; name: string }>;
  ingredientsByCode: Map<string, IngredientLean>;
  ingredientsByName: Map<string, IngredientLean>;
  unitCodeById: Map<string, string>;
  /** Current quantity per `${ingredientId}:${zoneId}`, shown in the preview before an opening balance overwrites it. */
  stockByKey: Map<string, number>;
}

const OPENING_BALANCE_REASON = 'ยอดยกมา (นำเข้าจาก Excel)';

@Injectable()
export class ImportsService {
  constructor(
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Zone.name) private readonly zoneModel: Model<ZoneDocument>,
    @InjectModel(ZoneStock.name)
    private readonly zoneStockModel: Model<ZoneStockDocument>,
    private readonly ingredientsService: IngredientsService,
    private readonly inventoryService: InventoryService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Validates every row first (dry run and real run share the same plan), then -- unless
   * dryRun -- creates missing categories/units, upserts ingredients and sets opening balances.
   * Rows are independent: one bad row never blocks the rest.
   */
  async importIngredients(
    dto: ImportIngredientsDto,
    user: RequestUser,
  ): Promise<ImportResult> {
    const lookups = await this.loadLookups();
    const planned = this.plan(dto.rows, lookups, user);

    if (!dto.dryRun) {
      await this.execute(planned, lookups, user);
    }

    const rows = planned.map((plannedRow) => plannedRow.result);
    const ok = planned.filter((p) => p.result.action !== 'ERROR');
    const result: ImportResult = {
      dryRun: dto.dryRun,
      summary: {
        total: rows.length,
        create: rows.filter((row) => row.action === 'CREATE').length,
        update: rows.filter((row) => row.action === 'UPDATE').length,
        error: rows.filter((row) => row.action === 'ERROR').length,
        openingBalances: ok.filter((p) => p.zoneId !== null).length,
        newCategories: uniqueCreateNames(ok.map((p) => p.category)),
        newUnits: uniqueCreateNames(
          ok.flatMap((p) => [p.baseUnit, p.packUnit]),
        ),
      },
      rows,
    };

    if (!dto.dryRun) {
      await this.auditLogsService.log({
        userId: user.id,
        action: 'INGREDIENTS_IMPORTED',
        entity: 'Ingredient',
        entityId: user.id,
        after: result.summary,
      });
    }
    return result;
  }

  private async loadLookups(): Promise<Lookups> {
    const [categories, units, zones, ingredients, stocks] = await Promise.all([
      this.categoryModel.find().lean(),
      this.unitModel.find().lean(),
      this.zoneModel.find({ status: 'ACTIVE' }).lean(),
      this.ingredientModel.find().lean<IngredientLean[]>(),
      this.zoneStockModel.find().lean(),
    ]);
    const byNameAndCode = <
      T extends { _id: Types.ObjectId; code: string; name: string },
    >(
      docs: T[],
    ): Map<string, string> => {
      const map = new Map<string, string>();
      for (const doc of docs) {
        map.set(normalizeKey(doc.name), doc._id.toString());
      }
      // Codes win over names when they collide.
      for (const doc of docs) {
        map.set(normalizeKey(doc.code), doc._id.toString());
      }
      return map;
    };
    const zoneMap = new Map<string, { id: string; name: string }>();
    for (const zone of zones) {
      const entry = { id: zone._id.toString(), name: zone.name };
      zoneMap.set(normalizeKey(zone.name), entry);
      zoneMap.set(normalizeKey(zone.description), entry);
      zoneMap.set(normalizeKey(zone.code), entry);
    }
    zoneMap.delete('');
    return {
      categories: byNameAndCode(categories),
      units: byNameAndCode(units),
      zones: zoneMap,
      ingredientsByCode: new Map(
        ingredients.map((ingredient) => [
          normalizeKey(ingredient.code),
          ingredient,
        ]),
      ),
      ingredientsByName: new Map(
        ingredients.map((ingredient) => [
          normalizeKey(ingredient.name),
          ingredient,
        ]),
      ),
      unitCodeById: new Map(
        units.map((unit) => [unit._id.toString(), unit.code]),
      ),
      stockByKey: new Map(
        stocks.map((stock) => [
          `${stock.ingredientId.toString()}:${stock.zoneId.toString()}`,
          stock.quantity,
        ]),
      ),
    };
  }

  private plan(
    rows: ImportIngredientRowDto[],
    lookups: Lookups,
    user: RequestUser,
  ): PlannedRow[] {
    const can = (code: string) => user.permissions.includes(code);
    const seen = new Map<string, number>();

    return rows.map((row, index) => {
      // The client sends the original sheet row (blank rows are dropped before upload).
      const rowNumber = row.rowNumber ?? index + 2;
      const errors: string[] = [];
      const notes: string[] = [];
      const name = row.name?.trim() ?? '';
      const code = row.code?.trim() ? row.code.trim().toUpperCase() : null;

      if (!name) {
        errors.push('ไม่มีชื่อวัตถุดิบ');
      }

      const duplicateKey = code ? `code:${code}` : `name:${normalizeKey(name)}`;
      const firstRow = seen.get(duplicateKey);
      if (firstRow !== undefined) {
        errors.push(`ซ้ำกับแถวที่ ${firstRow}`);
      } else if (name) {
        seen.set(duplicateKey, rowNumber);
      }

      const existing = code
        ? (lookups.ingredientsByCode.get(normalizeKey(code)) ?? null)
        : (lookups.ingredientsByName.get(normalizeKey(name)) ?? null);

      const category = this.resolveRef(
        row.category,
        lookups.categories,
        can(PERMISSION_CODES.CATEGORIES_CREATE),
        'หมวดหมู่',
        errors,
        notes,
      );
      const baseUnit = this.resolveRef(
        row.baseUnit,
        lookups.units,
        can(PERMISSION_CODES.UNITS_CREATE),
        'หน่วย',
        errors,
        notes,
      );

      // A unit that does not exist yet can never be the existing base unit either, so it is a
      // change of base unit too (otherwise the opening balance would be read in the wrong unit).
      if (
        existing &&
        baseUnit &&
        (!('id' in baseUnit) || baseUnit.id !== existing.baseUnitId.toString())
      ) {
        errors.push(
          `หน่วยหลักไม่ตรงกับของเดิม (${lookups.unitCodeById.get(existing.baseUnitId.toString()) ?? '-'}) -- ไม่สามารถเปลี่ยนหน่วยหลักผ่านการนำเข้าได้`,
        );
      }

      let packUnit: Ref | null = null;
      if (row.packUnit?.trim()) {
        if (!row.packFactor || row.packFactor <= 0) {
          errors.push('ระบุหน่วยแพ็คแล้ว ต้องระบุจำนวนต่อแพ็คที่มากกว่า 0');
        } else if (normalizeKey(row.packUnit) === normalizeKey(row.baseUnit)) {
          errors.push('หน่วยแพ็คต้องไม่ซ้ำกับหน่วยหลัก');
        } else {
          packUnit = this.resolveRef(
            row.packUnit,
            lookups.units,
            can(PERMISSION_CODES.UNITS_CREATE),
            'หน่วย',
            errors,
            notes,
          );
          // Different spellings ("KG" / "กิโลกรัม") can still resolve to the base unit itself.
          const baseUnitId =
            existing?.baseUnitId.toString() ??
            (baseUnit && 'id' in baseUnit ? baseUnit.id : null);
          if (packUnit && 'id' in packUnit && packUnit.id === baseUnitId) {
            errors.push('หน่วยแพ็คต้องไม่ซ้ำกับหน่วยหลัก');
          }
        }
      }

      let zoneId: string | null = null;
      if (row.openingQuantity !== undefined) {
        const zone = lookups.zones.get(normalizeKey(row.zone));
        if (!row.zone?.trim()) {
          errors.push('มียอดยกมา แต่ไม่ได้ระบุ Zone');
        } else if (!zone) {
          errors.push(`ไม่พบ Zone "${row.zone}"`);
        } else if (!can(PERMISSION_CODES.INVENTORY_ADJUST)) {
          errors.push('ไม่มีสิทธิ์ปรับสต๊อก จึงนำเข้ายอดยกมาไม่ได้');
        } else if (!user.isSuperScope && !user.zoneIds.includes(zone.id)) {
          errors.push(`ไม่มีสิทธิ์เข้าถึง Zone "${zone.name}"`);
        } else {
          zoneId = zone.id;
          const current = existing
            ? (lookups.stockByKey.get(
                `${existing._id.toString()}:${zone.id}`,
              ) ?? 0)
            : 0;
          const delta =
            Math.round((row.openingQuantity - current) * 10000) / 10000;
          notes.push(
            !existing
              ? `ตั้งยอดยกมา ${row.openingQuantity} ที่ ${zone.name}`
              : delta === 0
                ? `ยอดที่ ${zone.name} เท่าเดิม (${current}) ไม่มีการปรับ`
                : `⚠ ยอดที่ ${zone.name} ปัจจุบัน ${current} จะถูกตั้งเป็น ${row.openingQuantity} (${delta > 0 ? '+' : ''}${delta})`,
          );
        }
      }

      const action: ImportRowAction =
        errors.length > 0 ? 'ERROR' : existing ? 'UPDATE' : 'CREATE';
      return {
        result: {
          rowNumber,
          code: existing?.code ?? code,
          name,
          action,
          messages: errors.length > 0 ? errors : notes,
        },
        row,
        existing,
        category,
        baseUnit,
        packUnit,
        zoneId,
      };
    });
  }

  private resolveRef(
    value: string | undefined,
    map: Map<string, string>,
    canCreate: boolean,
    label: string,
    errors: string[],
    notes: string[],
  ): Ref | null {
    const name = value?.trim();
    if (!name) {
      errors.push(`ไม่ได้ระบุ${label}`);
      return null;
    }
    const id = map.get(normalizeKey(name));
    if (id) {
      return { id };
    }
    if (!canCreate) {
      errors.push(`ไม่พบ${label} "${name}" และไม่มีสิทธิ์สร้างใหม่`);
      return null;
    }
    notes.push(`สร้าง${label}ใหม่ "${name}"`);
    return { createName: name };
  }

  private async execute(
    planned: PlannedRow[],
    lookups: Lookups,
    user: RequestUser,
  ): Promise<void> {
    let nextCodeNumber = await this.nextIngredientCodeNumber();

    for (const plannedRow of planned) {
      if (plannedRow.result.action === 'ERROR') {
        continue;
      }
      const { row, existing, result } = plannedRow;
      try {
        const categoryId = await this.ensureCategory(
          plannedRow.category,
          lookups,
        );
        const baseUnitId = await this.ensureUnit(plannedRow.baseUnit, lookups);
        const packUnitId = plannedRow.packUnit
          ? await this.ensureUnit(plannedRow.packUnit, lookups)
          : null;

        const conversions = mergeConversions(
          existing?.unitConversions ?? [],
          packUnitId && row.packFactor
            ? { unitId: packUnitId, factor: row.packFactor }
            : null,
        );
        const fields = {
          name: row.name.trim(),
          categoryId,
          ...(row.minimumStock !== undefined
            ? { minimumStock: row.minimumStock }
            : {}),
          ...(row.maximumStock !== undefined
            ? { maximumStock: row.maximumStock }
            : {}),
          ...(row.defaultCost !== undefined
            ? { defaultCost: row.defaultCost }
            : {}),
          ...(row.description !== undefined
            ? { description: row.description }
            : {}),
          ...(row.tags !== undefined ? { tags: splitTags(row.tags) } : {}),
          ...(row.consignmentOwner !== undefined
            ? { consignmentOwner: row.consignmentOwner }
            : {}),
          unitConversions: conversions,
        };

        let ingredient: IngredientLean;
        if (existing) {
          ingredient = (await this.ingredientsService.update(
            existing._id.toString(),
            fields,
          )) as IngredientLean;
        } else {
          let code = result.code;
          while (!code || lookups.ingredientsByCode.has(normalizeKey(code))) {
            code = `ING-${String(nextCodeNumber).padStart(4, '0')}`;
            nextCodeNumber += 1;
          }
          ingredient = (await this.ingredientsService.create({
            ...fields,
            code,
            baseUnitId,
          })) as IngredientLean;
          result.code = ingredient.code;
        }
        lookups.ingredientsByCode.set(
          normalizeKey(ingredient.code),
          ingredient,
        );
        lookups.ingredientsByName.set(
          normalizeKey(ingredient.name),
          ingredient,
        );

        if (plannedRow.zoneId !== null && row.openingQuantity !== undefined) {
          const zoneId = plannedRow.zoneId;
          const target = row.openingQuantity;
          await this.inventoryService.withTransaction((session) =>
            this.inventoryService.setBalance(
              {
                ingredientId: ingredient._id.toString(),
                zoneId,
                target,
                unit: lookups.unitCodeById.get(baseUnitId) ?? '',
                unitCost: ingredient.defaultCost,
                performedBy: user.id,
                reason: OPENING_BALANCE_REASON,
                referenceType: 'IMPORT',
              },
              session,
            ),
          );
        }
      } catch (error) {
        result.action = 'ERROR';
        result.messages = [
          error instanceof Error ? error.message : 'นำเข้าไม่สำเร็จ',
        ];
      }
    }
  }

  private async ensureCategory(ref: Ref | null, lookups: Lookups) {
    if (!ref) {
      throw new Error('ไม่ได้ระบุหมวดหมู่');
    }
    if ('id' in ref) {
      return ref.id;
    }
    const existingId = lookups.categories.get(normalizeKey(ref.createName));
    if (existingId) {
      return existingId;
    }
    const code = await this.uniqueCode(this.categoryModel, ref.createName);
    const created = await this.categoryModel.create({
      code,
      name: ref.createName,
      status: 'ACTIVE',
    });
    const id = created._id.toString();
    lookups.categories.set(normalizeKey(ref.createName), id);
    lookups.categories.set(normalizeKey(code), id);
    return id;
  }

  private async ensureUnit(ref: Ref | null, lookups: Lookups) {
    if (!ref) {
      throw new Error('ไม่ได้ระบุหน่วย');
    }
    if ('id' in ref) {
      return ref.id;
    }
    const existingId = lookups.units.get(normalizeKey(ref.createName));
    if (existingId) {
      return existingId;
    }
    const code = await this.uniqueCode(this.unitModel, ref.createName);
    const created = await this.unitModel.create({
      code,
      name: ref.createName,
      ...guessUnitType(ref.createName),
      status: 'ACTIVE',
    });
    const id = created._id.toString();
    lookups.units.set(normalizeKey(ref.createName), id);
    lookups.units.set(normalizeKey(code), id);
    lookups.unitCodeById.set(id, code);
    return id;
  }

  private async uniqueCode(
    model: Model<CategoryDocument> | Model<UnitDocument>,
    name: string,
  ): Promise<string> {
    const base = codeFromName(name);
    let code = base;
    for (
      let suffix = 2;
      await (model as Model<CategoryDocument>).exists({ code });
      suffix += 1
    ) {
      code = `${base}_${suffix}`;
    }
    return code;
  }

  private async nextIngredientCodeNumber(): Promise<number> {
    const count = await this.ingredientModel.countDocuments({
      code: /^ING-\d+$/,
    });
    return count + 1;
  }
}

function uniqueCreateNames(refs: Array<Ref | null>): string[] {
  const names = new Map<string, string>();
  for (const ref of refs) {
    if (ref && 'createName' in ref) {
      names.set(normalizeKey(ref.createName), ref.createName);
    }
  }
  return [...names.values()];
}

/** Keeps an ingredient's existing pack units and adds/replaces the one from the spreadsheet. */
function mergeConversions(
  current: Array<{ unitId: Types.ObjectId; factor: number }>,
  incoming: { unitId: string; factor: number } | null,
): Array<{ unitId: string; factor: number }> {
  const merged = current.map((conversion) => ({
    unitId: conversion.unitId.toString(),
    factor: conversion.factor,
  }));
  if (!incoming) {
    return merged;
  }
  const index = merged.findIndex((c) => c.unitId === incoming.unitId);
  if (index >= 0) {
    merged[index] = incoming;
  } else {
    merged.push(incoming);
  }
  return merged;
}
