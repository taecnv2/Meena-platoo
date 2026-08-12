import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { ZonesService } from '../zones/zones.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
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
        if (!isDuplicateKeyError(error) || attempt === MAX_CODE_RETRIES - 1) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่ใบสั่งซื้อได้ กรุณาลองใหม่',
    );
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
