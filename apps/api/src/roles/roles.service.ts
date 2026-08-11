import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role, RoleDocument } from './schemas/role.schema';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  findAll(): Promise<Role[]> {
    return this.roleModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roleModel.findById(id).lean();
    if (!role) {
      throw new NotFoundException('ไม่พบบทบาทนี้');
    }
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleModel.findOne({ name: dto.name }).lean();
    if (existing) {
      throw new ConflictException('มีบทบาทนี้อยู่แล้ว');
    }
    const created = await this.roleModel.create(dto);
    return created.toObject();
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const updated = await this.roleModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบบทบาทนี้');
    }
    return updated;
  }
}
