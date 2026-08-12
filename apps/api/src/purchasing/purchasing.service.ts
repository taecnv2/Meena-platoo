import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { ZonesService } from '../zones/zones.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseOrderStatus,
} from './schemas/purchase-order.schema';

export interface FindPurchaseOrdersFilter {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

const MAX_CODE_RETRIES = 5;

@Injectable()
export class PurchasingService {
  constructor(
    @InjectModel(PurchaseOrder.name)
    private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    private readonly ingredientsService: IngredientsService,
    private readonly inventoryService: InventoryService,
    private readonly zonesService: ZonesService,
  ) {}

  findAll(filter: FindPurchaseOrdersFilter): Promise<PurchaseOrder[]> {
    const query: QueryFilter<PurchaseOrderDocument> = {};
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.supplierId) {
      query.supplierId = filter.supplierId;
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.purchaseOrderModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 200)
      .lean();
  }

  async findById(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderModel.findById(id).lean();
    if (!purchaseOrder) {
      throw new NotFoundException('ไม่พบใบสั่งซื้อนี้');
    }
    return purchaseOrder;
  }

  async create(
    dto: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const warehouseZoneId = await this.zonesService.getWarehouseZoneId();
    const items = await Promise.all(
      dto.items.map(async (item) => {
        const ingredient = await this.ingredientsService.findByIdWithUnit(
          item.ingredientId,
        );
        return {
          ingredientId: item.ingredientId,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unit: ingredient.baseUnitId.code,
          unitCost: item.unitCost,
        };
      }),
    );

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      const code = await this.generateCode();
      try {
        const created = await this.purchaseOrderModel.create({
          code,
          supplierId: dto.supplierId,
          status: 'DRAFT',
          items,
          deliveryZoneId: warehouseZoneId,
          createdBy: userId,
          remark: dto.remark ?? null,
        });
        return created.toObject();
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่ใบสั่งซื้อได้ กรุณาลองใหม่',
    );
  }

  async submit(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (purchaseOrder.status !== 'DRAFT') {
      throw new BadRequestException('ใบสั่งซื้อนี้ไม่อยู่ในสถานะร่าง');
    }
    purchaseOrder.status = 'PENDING';
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  async approve(id: string, userId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (purchaseOrder.status !== 'PENDING') {
      throw new BadRequestException('ใบสั่งซื้อนี้ไม่อยู่ในสถานะรออนุมัติ');
    }
    purchaseOrder.status = 'APPROVED';
    purchaseOrder.approvedBy = new Types.ObjectId(userId);
    purchaseOrder.approvedAt = new Date();
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  async reject(
    id: string,
    dto: RejectPurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (purchaseOrder.status !== 'PENDING') {
      throw new BadRequestException('ใบสั่งซื้อนี้ไม่อยู่ในสถานะรออนุมัติ');
    }
    purchaseOrder.status = 'REJECTED';
    purchaseOrder.rejectedBy = new Types.ObjectId(userId);
    purchaseOrder.rejectionReason = dto.rejectionReason;
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  async cancel(id: string, userId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getMutableOrThrow(id);
    if (!['DRAFT', 'PENDING'].includes(purchaseOrder.status)) {
      throw new BadRequestException(
        'ไม่สามารถยกเลิกใบสั่งซื้อที่อนุมัติแล้วได้',
      );
    }
    purchaseOrder.status = 'CANCELLED';
    purchaseOrder.cancelledBy = new Types.ObjectId(userId);
    await purchaseOrder.save();
    return purchaseOrder.toObject();
  }

  private async getMutableOrThrow(
    id: string,
  ): Promise<PurchaseOrderDocument> {
    const purchaseOrder = await this.purchaseOrderModel.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('ไม่พบใบสั่งซื้อนี้');
    }
    return purchaseOrder;
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.purchaseOrderModel.countDocuments({
      code: new RegExp(`^PO-${year}-`),
    });
    return `PO-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
