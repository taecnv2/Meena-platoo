import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoryModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categoryModel.findById(id).lean();
    if (!category) {
      throw new NotFoundException('ไม่พบหมวดหมู่นี้');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoryModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัสหมวดหมู่นี้อยู่แล้ว');
    }
    const created = await this.categoryModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const updated = await this.categoryModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบหมวดหมู่นี้');
    }
    return updated;
  }
}
