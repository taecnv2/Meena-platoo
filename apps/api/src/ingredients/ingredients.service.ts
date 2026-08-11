import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient, IngredientDocument } from './schemas/ingredient.schema';

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
  baseUnitId: { _id: Types.ObjectId; code: string; name: string };
}

@Injectable()
export class IngredientsService {
  constructor(
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
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
      .populate<{
        baseUnitId: { _id: Types.ObjectId; code: string; name: string };
      }>('baseUnitId')
      .lean();
    if (!ingredient) {
      throw new NotFoundException('ไม่พบวัตถุดิบนี้');
    }
    return ingredient;
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    const existing = await this.ingredientModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัสวัตถุดิบนี้อยู่แล้ว');
    }
    const created = await this.ingredientModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<Ingredient> {
    const updated = await this.ingredientModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบวัตถุดิบนี้');
    }
    return updated;
  }
}
