import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { StockCount, StockCountDocument } from './schemas/stock-count.schema';

export interface FindStockCountsFilter {
  zoneIds?: string[];
  limit?: number;
}

const MAX_CODE_RETRIES = 5;

@Injectable()
export class StockCountsService {
  constructor(
    @InjectModel(StockCount.name)
    private readonly stockCountModel: Model<StockCountDocument>,
    private readonly inventoryService: InventoryService,
    private readonly ingredientsService: IngredientsService,
  ) {}

  findAll(filter: FindStockCountsFilter): Promise<StockCount[]> {
    const query: QueryFilter<StockCountDocument> = {};
    if (filter.zoneIds) {
      query.zoneId = { $in: filter.zoneIds };
    }
    return this.stockCountModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 200)
      .lean();
  }

  async findById(id: string): Promise<StockCount> {
    const stockCount = await this.stockCountModel.findById(id).lean();
    if (!stockCount) {
      throw new NotFoundException('ไม่พบรายการตรวจนับสต๊อกนี้');
    }
    return stockCount;
  }

  async findZoneIdById(id: string, field: string): Promise<string> {
    if (field !== 'zoneId') {
      throw new BadRequestException(`StockCount has no zone field "${field}"`);
    }
    const stockCount = await this.stockCountModel
      .findById(id)
      .select('zoneId')
      .lean();
    if (!stockCount) {
      throw new NotFoundException('ไม่พบรายการตรวจนับสต๊อกนี้');
    }
    return stockCount.zoneId.toString();
  }

  async create(dto: CreateStockCountDto, userId: string): Promise<StockCount> {
    const expected = await this.inventoryService.getQuantities(
      dto.zoneId,
      dto.items.map((item) => item.ingredientId),
    );

    const items = await Promise.all(
      dto.items.map(async (item) => {
        const ingredient = await this.ingredientsService.findByIdWithUnit(
          item.ingredientId,
        );
        const expectedQuantity = expected.get(item.ingredientId) ?? 0;
        return {
          ingredientId: item.ingredientId,
          expectedQuantity,
          actualQuantity: item.actualQuantity,
          difference: round2(item.actualQuantity - expectedQuantity),
          unit: ingredient.baseUnitId.code,
        };
      }),
    );

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      const code = await this.generateCode();
      try {
        const created = await this.stockCountModel.create({
          code,
          zoneId: dto.zoneId,
          status: 'PENDING_APPROVAL',
          items,
          countedBy: userId,
        });
        return created.toObject();
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === MAX_CODE_RETRIES - 1) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่รายการตรวจนับได้ กรุณาลองใหม่',
    );
  }

  async approve(id: string, userId: string): Promise<StockCount> {
    const stockCount = await this.stockCountModel.findById(id);
    if (!stockCount) {
      throw new NotFoundException('ไม่พบรายการตรวจนับสต๊อกนี้');
    }
    if (stockCount.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('รายการตรวจนับนี้ไม่อยู่ในสถานะรออนุมัติ');
    }

    await this.inventoryService.withTransaction(async (session) => {
      for (const item of stockCount.items) {
        if (item.difference === 0) {
          continue;
        }
        const ingredient = await this.ingredientsService.findByIdWithUnit(
          item.ingredientId.toString(),
        );
        const base = {
          ingredientId: item.ingredientId.toString(),
          zoneId: stockCount.zoneId.toString(),
          unit: item.unit,
          unitCost: ingredient.defaultCost,
          performedBy: userId,
          reason: 'ปรับปรุงจากการตรวจนับสต๊อก',
          referenceType: 'STOCK_COUNT' as const,
          referenceId: stockCount._id.toString(),
        };
        if (item.difference > 0) {
          await this.inventoryService.increment(
            {
              ...base,
              quantity: item.difference,
              movementType: 'ADJUSTMENT_IN',
            },
            session,
          );
        } else {
          await this.inventoryService.decrement(
            {
              ...base,
              quantity: Math.abs(item.difference),
              movementType: 'ADJUSTMENT_OUT',
            },
            session,
          );
        }
      }
    });

    stockCount.status = 'APPROVED';
    stockCount.approvedBy = new Types.ObjectId(userId);
    stockCount.approvedAt = new Date();
    await stockCount.save();
    return stockCount.toObject();
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.stockCountModel.countDocuments({
      code: new RegExp(`^SC-${year}-`),
    });
    return `SC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
