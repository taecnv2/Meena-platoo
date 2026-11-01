import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, QueryFilter, Model } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { roundQuantity } from '../ingredients/unit-conversion.util';
import {
  type MovementType,
  type ReferenceType,
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
  inputQuantity?: number | null;
  inputUnit?: string | null;
  weight?: number | null;
  supplierId?: string | null;
  invoiceNo?: string | null;
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
    await this.zonesService.assertCanReceive(dto.zoneId);
    const resolved = await this.ingredientsService.resolveQuantity(
      dto.ingredientId,
      dto.quantity,
      dto.unitId,
    );
    const unitCost =
      dto.unitCost !== undefined
        ? dto.unitCost / resolved.factor
        : resolved.ingredient.defaultCost;
    return this.withTransaction((session) =>
      this.increment(
        {
          ingredientId: dto.ingredientId,
          zoneId: dto.zoneId,
          quantity: resolved.baseQuantity,
          unit: resolved.baseUnit,
          movementType: 'STOCK_IN',
          referenceType: 'STOCK_IN',
          referenceId: null,
          unitCost,
          performedBy: userId,
          remark: dto.remark ?? null,
          inputQuantity: resolved.inputQuantity,
          inputUnit: resolved.inputUnit,
          weight: dto.weight ?? null,
          supplierId: dto.supplierId ?? null,
          invoiceNo: dto.invoiceNo?.trim() || null,
        },
        session,
      ),
    );
  }

  async stockOut(dto: StockOutDto, userId: string): Promise<StockMovement> {
    const resolved = await this.ingredientsService.resolveQuantity(
      dto.ingredientId,
      dto.quantity,
      dto.unitId,
    );
    return this.withTransaction((session) =>
      this.decrement(
        {
          ingredientId: dto.ingredientId,
          zoneId: dto.zoneId,
          quantity: resolved.baseQuantity,
          unit: resolved.baseUnit,
          movementType: 'STOCK_OUT',
          referenceType: 'STOCK_OUT',
          referenceId: null,
          unitCost: resolved.ingredient.defaultCost,
          performedBy: userId,
          reason: dto.reason ?? 'KITCHEN_USE',
          remark: dto.remark ?? null,
          inputQuantity: resolved.inputQuantity,
          inputUnit: resolved.inputUnit,
          weight: dto.weight ?? null,
        },
        session,
      ),
    );
  }

  async adjust(dto: AdjustmentDto, userId: string): Promise<StockMovement> {
    if (dto.quantityDelta === 0) {
      throw new BadRequestException('จำนวนที่ปรับต้องไม่เป็นศูนย์');
    }
    const resolved = await this.ingredientsService.resolveQuantity(
      dto.ingredientId,
      Math.abs(dto.quantityDelta),
      dto.unitId,
    );
    const base = {
      ingredientId: dto.ingredientId,
      zoneId: dto.zoneId,
      unit: resolved.baseUnit,
      unitCost: resolved.ingredient.defaultCost,
      performedBy: userId,
      reason: dto.reason,
      remark: dto.remark ?? null,
      referenceType: 'ADJUSTMENT' as ReferenceType,
      referenceId: null,
      quantity: resolved.baseQuantity,
      inputQuantity: resolved.inputQuantity,
      inputUnit: resolved.inputUnit,
    };
    const movement = await this.withTransaction((session) =>
      dto.quantityDelta > 0
        ? this.increment({ ...base, movementType: 'ADJUSTMENT_IN' }, session)
        : this.decrement({ ...base, movementType: 'ADJUSTMENT_OUT' }, session),
    );
    await this.auditLogsService.log({
      userId,
      action: 'STOCK_ADJUSTED',
      entity: 'ZoneStock',
      entityId: dto.ingredientId,
      after: {
        zoneId: dto.zoneId,
        quantityDelta: dto.quantityDelta,
        unit: resolved.inputUnit,
        reason: dto.reason,
      },
    });
    return movement;
  }

  /**
   * Sets a zone's quantity to an absolute target (opening balance from an import) by posting
   * the difference as an ADJUSTMENT_IN/OUT. Returns null when the zone already holds `target`.
   */
  async setBalance(
    input: {
      ingredientId: string;
      zoneId: string;
      target: number;
      unit: string;
      unitCost: number;
      performedBy: string;
      reason: string;
      referenceType: ReferenceType;
    },
    session: ClientSession,
  ): Promise<StockMovement | null> {
    const current = await this.zoneStockModel
      .findOne({ ingredientId: input.ingredientId, zoneId: input.zoneId })
      .session(session)
      .lean();
    const delta = roundQuantity(input.target - (current?.quantity ?? 0));
    if (delta === 0) {
      return null;
    }
    const movement: MovementInput = {
      ingredientId: input.ingredientId,
      zoneId: input.zoneId,
      quantity: Math.abs(delta),
      unit: input.unit,
      movementType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      referenceType: input.referenceType,
      referenceId: null,
      unitCost: input.unitCost,
      performedBy: input.performedBy,
      reason: input.reason,
    };
    return delta > 0
      ? this.increment(movement, session)
      : this.decrement(movement, session);
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
