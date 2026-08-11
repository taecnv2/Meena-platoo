import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WAREHOUSE_ZONE_CODE } from '../common/constants/zones';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Zone, ZoneDocument } from './schemas/zone.schema';

@Injectable()
export class ZonesService {
  constructor(
    @InjectModel(Zone.name) private readonly zoneModel: Model<ZoneDocument>,
  ) {}

  findAll(): Promise<Zone[]> {
    return this.zoneModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Zone> {
    const zone = await this.zoneModel.findById(id).lean();
    if (!zone) {
      throw new NotFoundException('ไม่พบ Zone นี้');
    }
    return zone;
  }

  async create(dto: CreateZoneDto): Promise<Zone> {
    const existing = await this.zoneModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัส Zone นี้อยู่แล้ว');
    }
    const created = await this.zoneModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateZoneDto): Promise<Zone> {
    const updated = await this.zoneModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบ Zone นี้');
    }
    return updated;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<Zone> {
    if (status === 'INACTIVE') {
      const zone = await this.findById(id);
      if (zone.code === WAREHOUSE_ZONE_CODE) {
        throw new BadRequestException('ไม่สามารถปิดใช้งานคลังสินค้าหลักได้');
      }
    }
    const updated = await this.zoneModel
      .findByIdAndUpdate(id, { status }, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบ Zone นี้');
    }
    return updated;
  }

  async getWarehouseZoneId(): Promise<string> {
    const zone = await this.zoneModel
      .findOne({ code: WAREHOUSE_ZONE_CODE })
      .lean();
    if (!zone) {
      throw new NotFoundException('ไม่พบโซนคลังสินค้าหลักในระบบ');
    }
    return zone._id.toString();
  }
}
