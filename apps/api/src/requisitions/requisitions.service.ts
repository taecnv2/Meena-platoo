import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { IngredientsService } from '../ingredients/ingredients.service';
import { TransfersService } from '../transfers/transfers.service';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { FulfillRequisitionDto } from './dto/fulfill-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import {
  Requisition,
  RequisitionDocument,
  RequisitionStatus,
} from './schemas/requisition.schema';

export interface FindRequisitionsFilter {
  zoneIds?: string[];
  status?: RequisitionStatus;
  limit?: number;
}

const MAX_CODE_RETRIES = 5;

@Injectable()
export class RequisitionsService {
  constructor(
    @InjectModel(Requisition.name)
    private readonly requisitionModel: Model<RequisitionDocument>,
    private readonly ingredientsService: IngredientsService,
    private readonly transfersService: TransfersService,
  ) {}

  findAll(filter: FindRequisitionsFilter): Promise<Requisition[]> {
    const query: QueryFilter<RequisitionDocument> = {};
    if (filter.zoneIds) {
      query.$or = [
        { fromZoneId: { $in: filter.zoneIds } },
        { toZoneId: { $in: filter.zoneIds } },
      ];
    }
    if (filter.status) {
      query.status = filter.status;
    }
    return this.requisitionModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 200)
      .lean();
  }

  async findById(id: string): Promise<Requisition> {
    const requisition = await this.requisitionModel.findById(id).lean();
    if (!requisition) {
      throw new NotFoundException('ไม่พบใบเบิกสินค้านี้');
    }
    return requisition;
  }

  async findZoneIdById(id: string, field: string): Promise<string> {
    const requisition = await this.requisitionModel
      .findById(id)
      .select(field)
      .lean();
    if (!requisition) {
      throw new NotFoundException('ไม่พบใบเบิกสินค้านี้');
    }
    const zoneId =
      field === 'fromZoneId' ? requisition.fromZoneId : requisition.toZoneId;
    return zoneId.toString();
  }

  async create(
    dto: CreateRequisitionDto,
    userId: string,
  ): Promise<Requisition> {
    const items = await Promise.all(
      dto.items.map(async (item) => {
        const ingredient = await this.ingredientsService.findByIdWithUnit(
          item.ingredientId,
        );
        return {
          ingredientId: item.ingredientId,
          requestedQuantity: item.requestedQuantity,
          approvedQuantity: 0,
          fulfilledQuantity: 0,
          unit: ingredient.baseUnitId.code,
          unitCost: ingredient.defaultCost,
        };
      }),
    );

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      const code = await this.generateCode();
      try {
        const created = await this.requisitionModel.create({
          code,
          fromZoneId: dto.fromZoneId,
          toZoneId: dto.toZoneId,
          status: 'PENDING',
          items,
          requestedBy: userId,
        });
        return created.toObject();
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === MAX_CODE_RETRIES - 1) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่ใบเบิกสินค้าได้ กรุณาลองใหม่',
    );
  }

  async approve(
    id: string,
    dto: ApproveRequisitionDto,
    userId: string,
  ): Promise<Requisition> {
    const requisition = await this.getMutableOrThrow(id);
    if (requisition.status !== 'PENDING') {
      throw new BadRequestException('ใบเบิกสินค้านี้ไม่อยู่ในสถานะรออนุมัติ');
    }

    const overrides = new Map(
      (dto.items ?? []).map((item) => [
        item.ingredientId,
        item.approvedQuantity,
      ]),
    );
    requisition.items.forEach((item) => {
      const override = overrides.get(item.ingredientId.toString());
      item.approvedQuantity = override ?? item.requestedQuantity;
    });
    requisition.status = 'APPROVED';
    requisition.approvedBy = new Types.ObjectId(userId);
    requisition.approvedAt = new Date();
    await requisition.save();
    return requisition.toObject();
  }

  async reject(
    id: string,
    dto: RejectRequisitionDto,
    userId: string,
  ): Promise<Requisition> {
    const requisition = await this.getMutableOrThrow(id);
    if (requisition.status !== 'PENDING') {
      throw new BadRequestException('ใบเบิกสินค้านี้ไม่อยู่ในสถานะรออนุมัติ');
    }
    requisition.status = 'REJECTED';
    requisition.rejectedBy = new Types.ObjectId(userId);
    requisition.rejectionReason = dto.rejectionReason;
    await requisition.save();
    return requisition.toObject();
  }

  async cancel(id: string, userId: string): Promise<Requisition> {
    const requisition = await this.getMutableOrThrow(id);
    if (!['DRAFT', 'PENDING', 'APPROVED'].includes(requisition.status)) {
      throw new BadRequestException(
        'ไม่สามารถยกเลิกใบเบิกสินค้าที่จ่ายสินค้าไปแล้วได้',
      );
    }
    requisition.status = 'CANCELLED';
    requisition.cancelledBy = new Types.ObjectId(userId);
    await requisition.save();
    return requisition.toObject();
  }

  async fulfill(
    id: string,
    dto: FulfillRequisitionDto,
    userId: string,
  ): Promise<Requisition> {
    const requisition = await this.getMutableOrThrow(id);
    if (!['APPROVED', 'PARTIALLY_FULFILLED'].includes(requisition.status)) {
      throw new BadRequestException(
        'ใบเบิกสินค้านี้ไม่อยู่ในสถานะที่สามารถจ่ายสินค้าได้',
      );
    }

    for (const fulfillItem of dto.items) {
      const item = requisition.items.find(
        (i) => i.ingredientId.toString() === fulfillItem.ingredientId,
      );
      if (!item) {
        throw new BadRequestException('พบวัตถุดิบที่ไม่อยู่ในใบเบิกสินค้านี้');
      }
      const remaining = item.approvedQuantity - item.fulfilledQuantity;
      if (fulfillItem.quantity > remaining) {
        throw new BadRequestException(
          `จำนวนที่จ่ายเกินจำนวนที่เหลือของรายการนี้ (เหลือ ${remaining})`,
        );
      }
    }

    await this.transfersService.executeTransfer({
      fromZoneId: dto.fromZoneId,
      toZoneId: requisition.toZoneId.toString(),
      items: dto.items,
      requisitionId: id,
      performedBy: userId,
    });

    dto.items.forEach((fulfillItem) => {
      const item = requisition.items.find(
        (i) => i.ingredientId.toString() === fulfillItem.ingredientId,
      );
      if (item) {
        item.fulfilledQuantity += fulfillItem.quantity;
      }
    });

    const allFulfilled = requisition.items.every(
      (item) => item.fulfilledQuantity >= item.approvedQuantity,
    );
    requisition.status = allFulfilled ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
    if (allFulfilled) {
      requisition.fulfilledAt = new Date();
    }
    await requisition.save();
    return requisition.toObject();
  }

  private async getMutableOrThrow(id: string): Promise<RequisitionDocument> {
    const requisition = await this.requisitionModel.findById(id);
    if (!requisition) {
      throw new NotFoundException('ไม่พบใบเบิกสินค้านี้');
    }
    return requisition;
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.requisitionModel.countDocuments({
      code: new RegExp(`^REQ-${year}-`),
    });
    return `REQ-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
