import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

export interface AuthContext extends RequestUser {
  status: 'ACTIVE' | 'INACTIVE';
}

/** User shape safe to return to clients -- passwordHash is never included. */
export interface SafeUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  name: string;
  roleId: Types.ObjectId;
  zoneIds: Types.ObjectId[];
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: Date | null;
}

interface PopulatedRole {
  _id: Types.ObjectId;
  name: string;
  permissions: string[];
  allZoneAccess: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  findAll(): Promise<SafeUser[]> {
    return this.userModel.find().sort({ username: 1 }).lean<SafeUser[]>();
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.userModel.findById(id).lean<SafeUser | null>();
    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้งานนี้');
    }
    return user;
  }

  findByUsernameWithPassword(
    username: string,
  ): Promise<(User & { _id: Types.ObjectId }) | null> {
    return this.userModel
      .findOne({ username: username.toLowerCase() })
      .select('+passwordHash')
      .lean<(User & { _id: Types.ObjectId }) | null>();
  }

  async findAuthContextById(id: string): Promise<AuthContext | null> {
    const user = await this.userModel
      .findById(id)
      .populate<{ roleId: PopulatedRole }>('roleId')
      .lean();
    if (!user) {
      return null;
    }
    return {
      id: user._id.toString(),
      username: user.username,
      roleId: user.roleId._id.toString(),
      roleName: user.roleId.name,
      permissions: user.roleId.permissions,
      zoneIds: user.zoneIds.map((zoneId) => zoneId.toString()),
      isSuperScope: user.roleId.allZoneAccess,
      status: user.status,
    };
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.userModel
      .findOne({
        $or: [
          { username: dto.username.toLowerCase() },
          { email: dto.email.toLowerCase() },
        ],
      })
      .lean();
    if (existing) {
      throw new ConflictException('มีชื่อผู้ใช้งานหรืออีเมลนี้อยู่แล้ว');
    }
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.configService.get('bcryptSaltRounds', { infer: true }),
    );
    const created = await this.userModel.create({
      username: dto.username.toLowerCase(),
      email: dto.email.toLowerCase(),
      name: dto.name,
      passwordHash,
      roleId: dto.roleId,
      zoneIds: dto.zoneIds ?? [],
      status: dto.status ?? 'ACTIVE',
    });
    return {
      _id: created._id,
      username: created.username,
      email: created.email,
      name: created.name,
      roleId: created.roleId,
      zoneIds: created.zoneIds,
      status: created.status,
      lastLoginAt: created.lastLoginAt,
    };
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean<SafeUser | null>();
    if (!updated) {
      throw new NotFoundException('ไม่พบผู้ใช้งานนี้');
    }
    return updated;
  }

  async setStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<SafeUser> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { status }, { returnDocument: 'after' })
      .lean<SafeUser | null>();
    if (!updated) {
      throw new NotFoundException('ไม่พบผู้ใช้งานนี้');
    }
    return updated;
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(
      newPassword,
      this.configService.get('bcryptSaltRounds', { infer: true }),
    );
    const updated = await this.userModel
      .findByIdAndUpdate(id, { passwordHash })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบผู้ใช้งานนี้');
    }
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { lastLoginAt: new Date() });
  }
}
