import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWasteDto } from './dto/create-waste.dto';
import { RejectWasteDto } from './dto/reject-waste.dto';
import { Waste, WasteDocument, WasteStatus } from './schemas/waste.schema';

export interface FindWasteFilter {
  zoneIds?: string[];
  status?: WasteStatus;
  ingredientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const MAX_CODE_RETRIES = 5;

@Injectable()
export class WasteService {
  constructor(
    @InjectModel(Waste.name)
    private readonly wasteModel: Model<WasteDocument>,
    private readonly inventoryService: InventoryService,
    private readonly ingredientsService: IngredientsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(filter: FindWasteFilter): Promise<Waste[]> {
    const query: QueryFilter<WasteDocument> = {};
    if (filter.zoneIds) {
      query.zoneId = { $in: filter.zoneIds };
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.ingredientId) {
      query.ingredientId = filter.ingredientId;
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.wasteModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
  }

  async findById(id: string): Promise<Waste> {
    const waste = await this.wasteModel.findById(id).lean();
    if (!waste) {
      throw new NotFoundException('ไม่พบรายการของเสียนี้');
    }
    return waste;
  }

  async findZoneIdById(id: string, field: string): Promise<string> {
    if (field !== 'zoneId') {
      throw new BadRequestException(`Waste has no zone field "${field}"`);
    }
    const waste = await this.wasteModel.findById(id).select('zoneId').lean();
    if (!waste) {
      throw new NotFoundException('ไม่พบรายการของเสียนี้');
    }
    return waste.zoneId.toString();
  }

  async create(dto: CreateWasteDto, userId: string): Promise<Waste> {
    const ingredient = await this.ingredientsService.findByIdWithUnit(
      dto.ingredientId,
    );

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      const code = await this.generateCode();
      try {
        const created = await this.wasteModel.create({
          code,
          zoneId: dto.zoneId,
          ingredientId: dto.ingredientId,
          quantity: dto.quantity,
          unit: ingredient.baseUnitId.code,
          reason: dto.reason,
          unitCost: ingredient.defaultCost,
          status: 'PENDING_APPROVAL',
          reportedBy: userId,
          remark: dto.remark ?? null,
        });
        const waste = created.toObject();
        await this.auditLogsService.log({
          userId,
          action: 'WASTE_CREATED',
          entity: 'Waste',
          entityId: waste._id.toString(),
          after: {
            code: waste.code,
            zoneId: waste.zoneId,
            ingredientId: waste.ingredientId,
            quantity: waste.quantity,
            reason: waste.reason,
          },
        });
        return waste;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่รายการของเสียได้ กรุณาลองใหม่',
    );
  }

  async approve(id: string, userId: string): Promise<Waste> {
    const waste = await this.wasteModel.findById(id);
    if (!waste) {
      throw new NotFoundException('ไม่พบรายการของเสียนี้');
    }
    if (waste.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('รายการของเสียนี้ไม่อยู่ในสถานะรออนุมัติ');
    }

    await this.inventoryService.withTransaction((session) =>
      this.inventoryService.decrement(
        {
          ingredientId: waste.ingredientId.toString(),
          zoneId: waste.zoneId.toString(),
          quantity: waste.quantity,
          unit: waste.unit,
          movementType: 'WASTE',
          referenceType: 'WASTE',
          referenceId: waste._id.toString(),
          unitCost: waste.unitCost,
          performedBy: userId,
          reason: waste.reason,
          remark: waste.remark,
        },
        session,
      ),
    );

    waste.status = 'APPROVED';
    waste.approvedBy = new Types.ObjectId(userId);
    waste.approvedAt = new Date();
    await waste.save();
    const approved = waste.toObject();
    await this.notificationsService.create({
      userId: approved.reportedBy.toString(),
      type: 'WASTE_APPROVED',
      title: 'รายการของเสียได้รับการอนุมัติ',
      message: `รายการของเสีย ${approved.code} ได้รับการอนุมัติแล้ว`,
      entity: 'Waste',
      entityId: approved._id.toString(),
    });
    return approved;
  }

  async reject(
    id: string,
    dto: RejectWasteDto,
    userId: string,
  ): Promise<Waste> {
    const waste = await this.wasteModel.findById(id);
    if (!waste) {
      throw new NotFoundException('ไม่พบรายการของเสียนี้');
    }
    if (waste.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('รายการของเสียนี้ไม่อยู่ในสถานะรออนุมัติ');
    }

    waste.status = 'REJECTED';
    waste.rejectedBy = new Types.ObjectId(userId);
    waste.rejectionReason = dto.rejectionReason;
    await waste.save();
    const rejected = waste.toObject();
    await this.notificationsService.create({
      userId: rejected.reportedBy.toString(),
      type: 'WASTE_REJECTED',
      title: 'รายการของเสียถูกปฏิเสธ',
      message: `รายการของเสีย ${rejected.code} ถูกปฏิเสธ: ${rejected.rejectionReason ?? ''}`,
      entity: 'Waste',
      entityId: rejected._id.toString(),
    });
    return rejected;
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.wasteModel.countDocuments({
      code: new RegExp(`^WS-${year}-`),
    });
    return `WS-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
