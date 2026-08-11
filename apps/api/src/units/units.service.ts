import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Unit, UnitDocument } from './schemas/unit.schema';

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
  ) {}

  findAll(): Promise<Unit[]> {
    return this.unitModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Unit> {
    const unit = await this.unitModel.findById(id).lean();
    if (!unit) {
      throw new NotFoundException('ไม่พบหน่วยนับนี้');
    }
    return unit;
  }

  async create(dto: CreateUnitDto): Promise<Unit> {
    const existing = await this.unitModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัสหน่วยนับนี้อยู่แล้ว');
    }
    const created = await this.unitModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateUnitDto): Promise<Unit> {
    const updated = await this.unitModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบหน่วยนับนี้');
    }
    return updated;
  }
}
