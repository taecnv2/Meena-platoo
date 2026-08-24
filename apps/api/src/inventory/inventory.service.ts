import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, QueryFilter, Model } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import {
  MovementType,
  ReferenceType,
  StockMovement,
} from '../stock-movements/schemas/stock-movement.schema';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { ZonesService } from '../zones/zones.service';
import { AdjustmentDto } from './dto/adjustment.dto';
import { StockInDto } from './dto/stock-in.dto';
import { StockOutDto } from './dto/stock-out.dto';
import { ZoneStock, ZoneStockDocument } from './schemas/zone-stock.schema';

export interface MovementInput {
  ingredientId: string;
  zoneId: string;
  quantity: number;
  unit: string;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string | null;
  unitCost: number;
  performedBy: string;
  reason?: string | null;
  remark?: string | null;
}

export interface BalanceFilter {
  zoneId?: string;
  ingredientId?: string;
  zoneIds?: string[];
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(ZoneStock.name)
    private readonly zoneStockModel: Model<ZoneStockDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly stockMovementsService: StockMovementsService,
    private readonly ingredientsService: IngredientsService,
    private readonly zonesService: ZonesService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findBalances(filter: BalanceFilter): Promise<ZoneStock[]> {
    const query: QueryFilter<ZoneStockDocument> = {};
    if (filter.ingredientId) {
      query.ingredientId = filter.ingredientId;
    }
    if (filter.zoneId) {
      query.zoneId = filter.zoneId;
    } else if (filter.zoneIds) {
      query.zoneId = { $in: filter.zoneIds };
    }
    return this.zoneStockModel.find(query).lean();
  }

  /** Used by StockCountsService to snapshot "expected" quantities when a count is created. */
  async getQuantities(
    zoneId: string,
    ingredientIds: string[],
  ): Promise<Map<string, number>> {
    const balances = await this.zoneStockModel
      .find({ zoneId, ingredientId: { $in: ingredientIds } })
      .lean();
    return new Map(
      balances.map((balance) => [
        balance.ingredientId.toString(),
        balance.quantity,
      ]),
    );
  }

  async stockIn(dto: StockInDto, userId: string): Promise<StockMovement> {
    const warehouseZoneId = await this.zonesService.getWarehouseZoneId();
    if (dto.zoneId !== warehouseZoneId) {
      throw new BadRequestException('รับสินค้าได้เฉพาะที่คลังสินค้าเท่านั้น');
    }
    const ingredient = await this.ingredientsService.findByIdWithUnit(
      dto.ingredientId,
    );
    return this.withTransaction((session) =>
      this.increment(
        {
          ingredientId: dto.ingredientId,
          zoneId: dto.zoneId,
          quantity: dto.quantity,
          unit: ingredient.baseUnitId.code,
          movementType: 'STOCK_IN',
          referenceType: 'STOCK_IN',
          referenceId: null,
          unitCost: dto.unitCost ?? ingredient.defaultCost,
          performedBy: userId,
          remark: dto.remark ?? null,
        },
        session,
      ),
    );
  }

  async stockOut(dto: StockOutDto, userId: string): Promise<StockMovement> {
    const ingredient = await this.ingredientsService.findByIdWithUnit(
      dto.ingredientId,
    );
    return this.withTransaction((session) =>
      this.decrement(
        {
          ingredientId: dto.ingredientId,
          zoneId: dto.zoneId,
          quantity: dto.quantity,
          unit: ingredient.baseUnitId.code,
          movementType: 'STOCK_OUT',
          referenceType: 'STOCK_OUT',
          referenceId: null,
          unitCost: ingredient.defaultCost,
          performedBy: userId,
          remark: dto.remark ?? null,
        },
        session,
      ),
    );
  }

  async adjust(dto: AdjustmentDto, userId: string): Promise<StockMovement> {
    if (dto.quantityDelta === 0) {
      throw new BadRequestException('จำนวนที่ปรับต้องไม่เป็นศูนย์');
    }
    const ingredient = await this.ingredientsService.findByIdWithUnit(
      dto.ingredientId,
    );
    const base = {
      ingredientId: dto.ingredientId,
      zoneId: dto.zoneId,
      unit: ingredient.baseUnitId.code,
      unitCost: ingredient.defaultCost,
      performedBy: userId,
      reason: dto.reason,
      remark: dto.remark ?? null,
      referenceType: 'ADJUSTMENT' as ReferenceType,
      referenceId: null,
    };
    const movement = await this.withTransaction((session) =>
      dto.quantityDelta > 0
        ? this.increment(
            {
              ...base,
              quantity: dto.quantityDelta,
              movementType: 'ADJUSTMENT_IN',
            },
            session,
          )
        : this.decrement(
            {
              ...base,
              quantity: Math.abs(dto.quantityDelta),
              movementType: 'ADJUSTMENT_OUT',
            },
            session,
          ),
    );
    await this.auditLogsService.log({
      userId,
      action: 'STOCK_ADJUSTED',
      entity: 'ZoneStock',
      entityId: dto.ingredientId,
      after: {
        zoneId: dto.zoneId,
        quantityDelta: dto.quantityDelta,
        reason: dto.reason,
      },
    });
    return movement;
  }

  /** Atomic primitive: always increases stock, upserts the ZoneStock row. Requires a session. */
  async increment(
    input: MovementInput,
    session: ClientSession,
  ): Promise<StockMovement> {
    await this.zoneStockModel.findOneAndUpdate(
      { ingredientId: input.ingredientId, zoneId: input.zoneId },
      { $inc: { quantity: input.quantity } },
      { upsert: true, returnDocument: 'after', session },
    );
    return this.stockMovementsService.record(
      { ...input, totalCost: round2(input.unitCost * input.quantity) },
      session,
    );
  }

  /**
   * Atomic primitive: decreases stock only if enough is available (conditional $gte match),
   * otherwise throws without writing a movement (plan.md §40 -- no negative inventory).
   * Requires a session.
   */
  async decrement(
    input: MovementInput,
    session: ClientSession,
  ): Promise<StockMovement> {
    const updated = await this.zoneStockModel.findOneAndUpdate(
      {
        ingredientId: input.ingredientId,
        zoneId: input.zoneId,
        quantity: { $gte: input.quantity },
      },
      { $inc: { quantity: -input.quantity } },
      { returnDocument: 'after', session },
    );
    if (!updated) {
      throw new ConflictException('สต๊อกไม่เพียงพอ');
    }
    return this.stockMovementsService.record(
      { ...input, totalCost: round2(input.unitCost * input.quantity) },
      session,
    );
  }

  /** Runs `fn` inside a MongoDB session/transaction, always ending the session afterwards. */
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
