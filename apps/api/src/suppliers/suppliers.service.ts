import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier, SupplierDocument } from './schemas/supplier.schema';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
  ) {}

  findAll(): Promise<Supplier[]> {
    return this.supplierModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Supplier> {
    const supplier = await this.supplierModel.findById(id).lean();
    if (!supplier) {
      throw new NotFoundException('ไม่พบ Supplier นี้');
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const existing = await this.supplierModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัส Supplier นี้อยู่แล้ว');
    }
    const created = await this.supplierModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const updated = await this.supplierModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบ Supplier นี้');
    }
    return updated;
  }
}
