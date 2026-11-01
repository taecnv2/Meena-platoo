import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Unit, UnitDocument, UnitType } from '../units/schemas/unit.schema';
import {
  CreateIngredientDto,
  IngredientUnitConversionDto,
} from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient, IngredientDocument } from './schemas/ingredient.schema';
import { resolveConversionFactor, roundQuantity } from './unit-conversion.util';

export interface PopulatedUnit {
  _id: Types.ObjectId;
  code: string;
  name: string;
  type: UnitType;
  conversionFactor: number;
}

/** Ingredient with its base unit resolved -- used by inventory/requisitions to snapshot unit + cost. */
export interface IngredientWithUnit {
  _id: Types.ObjectId;
  code: string;
  name: string;
  categoryId: Types.ObjectId;
  defaultCost: number;
  minimumStock: number;
  maximumStock: number;
  status: 'ACTIVE' | 'INACTIVE';
  baseUnitId: PopulatedUnit;
  unitConversions?: Array<{ unitId: Types.ObjectId; factor: number }>;
  consignmentOwner?: string | null;
}

/** A quantity a user entered in some unit, normalized to the ingredient's base unit. */
export interface ResolvedQuantity {
  ingredient: IngredientWithUnit;
  /** Quantity in the ingredient's base unit -- what ZoneStock and StockMovement.quantity hold. */
  baseQuantity: number;
  baseUnit: string;
  /** 1 input unit = factor x base unit. */
  factor: number;
  inputQuantity: number;
  inputUnit: string;
}

@Injectable()
export class IngredientsService {
  constructor(
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
    @InjectModel(Unit.name)
    private readonly unitModel: Model<UnitDocument>,
  ) {}

  findAll(): Promise<Ingredient[]> {
    return this.ingredientModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientModel.findById(id).lean();
    if (!ingredient) {
      throw new NotFoundException('ไม่พบวัตถุดิบนี้');
    }
    return ingredient;
  }

  async findByIdWithUnit(id: string): Promise<IngredientWithUnit> {
    const ingredient = await this.ingredientModel
      .findById(id)
      .populate<{ baseUnitId: PopulatedUnit }>('baseUnitId')
      .lean();
    if (!ingredient) {
      throw new NotFoundException('ไม่พบวัตถุดิบนี้');
    }
    return ingredient;
  }

  /**
   * Converts a quantity entered in `unitId` (default: the base unit) to the ingredient's base
   * unit. Every stock-affecting flow calls this before touching InventoryService, so ZoneStock
   * always holds a single unit per ingredient while staff can still key in ลัง/ถุง/กรัม.
   */
  async resolveQuantity(
    ingredientId: string,
    quantity: number,
    unitId?: string | null,
  ): Promise<ResolvedQuantity> {
    const ingredient = await this.findByIdWithUnit(ingredientId);
    const baseUnit = ingredient.baseUnitId;
    if (!unitId || unitId === baseUnit._id.toString()) {
      return {
        ingredient,
        baseQuantity: roundQuantity(quantity),
        baseUnit: baseUnit.code,
        factor: 1,
        inputQuantity: quantity,
        inputUnit: baseUnit.code,
      };
    }
    const unit = await this.unitModel.findById(unitId).lean();
    if (!unit) {
      throw new NotFoundException('ไม่พบหน่วยนับนี้');
    }
    const factor = resolveConversionFactor(
      baseUnit,
      unit,
      ingredient.unitConversions ?? [],
    );
    if (factor === null) {
      throw new BadRequestException(
        `วัตถุดิบ "${ingredient.name}" ไม่ได้ตั้งค่าการแปลงหน่วย ${unit.name} (${unit.code})`,
      );
    }
    return {
      ingredient,
      baseQuantity: roundQuantity(quantity * factor),
      baseUnit: baseUnit.code,
      factor,
      inputQuantity: quantity,
      inputUnit: unit.code,
    };
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    const existing = await this.ingredientModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัสวัตถุดิบนี้อยู่แล้ว');
    }
    await this.assertValidConversions(dto.baseUnitId, dto.unitConversions);
    const created = await this.ingredientModel.create({
      ...dto,
      ...normalizeExtras(dto),
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<Ingredient> {
    if (dto.unitConversions || dto.baseUnitId) {
      const current = await this.findById(id);
      await this.assertValidConversions(
        dto.baseUnitId ?? current.baseUnitId.toString(),
        dto.unitConversions ??
          current.unitConversions.map((conversion) => ({
            unitId: conversion.unitId.toString(),
            factor: conversion.factor,
          })),
      );
    }
    const updated = await this.ingredientModel
      .findByIdAndUpdate(
        id,
        { ...dto, ...normalizeExtras(dto) },
        { returnDocument: 'after' },
      )
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบวัตถุดิบนี้');
    }
    return updated;
  }

  private async assertValidConversions(
    baseUnitId: string,
    conversions: IngredientUnitConversionDto[] | undefined,
  ): Promise<void> {
    if (!conversions || conversions.length === 0) {
      return;
    }
    if (conversions.some((conversion) => conversion.unitId === baseUnitId)) {
      throw new BadRequestException(
        'หน่วยแปลงต้องไม่ซ้ำกับหน่วยหลักของวัตถุดิบ',
      );
    }
    const unitIds = conversions.map((conversion) => conversion.unitId);
    const found = await this.unitModel.countDocuments({
      _id: { $in: unitIds },
    });
    if (found !== new Set(unitIds).size) {
      throw new BadRequestException('ไม่พบหน่วยนับบางรายการในการแปลงหน่วย');
    }
  }
}

/** Trims/dedupes tags and turns a blank consignment owner into null (= restaurant-owned). */
function normalizeExtras(
  dto: Pick<UpdateIngredientDto, 'tags' | 'consignmentOwner'>,
): Partial<Pick<Ingredient, 'tags' | 'consignmentOwner'>> {
  const extras: Partial<Pick<Ingredient, 'tags' | 'consignmentOwner'>> = {};
  if (dto.tags) {
    extras.tags = [
      ...new Set(dto.tags.map((tag) => tag.trim()).filter(Boolean)),
    ];
  }
  if (dto.consignmentOwner !== undefined) {
    extras.consignmentOwner = dto.consignmentOwner?.trim() || null;
  }
  return extras;
}
