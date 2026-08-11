import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, QueryFilter, Model } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import {
  MovementType,
  ReferenceType,
  StockMovement,
  StockMovementDocument,
} from './schemas/stock-movement.schema';

export interface RecordMovementInput {
  ingredientId: string;
  zoneId: string;
  quantity: number;
  unit: string;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string | null;
  unitCost: number;
  totalCost: number;
  performedBy: string;
  reason?: string | null;
  remark?: string | null;
}

export interface FindMovementsFilter {
  ingredientId?: string;
  zoneId?: string;
  zoneIds?: string[];
  movementType?: MovementType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovementDocument>,
  ) {}

  async record(
    input: RecordMovementInput,
    session?: ClientSession,
  ): Promise<StockMovement> {
    const [doc] = await this.movementModel.create(
      [
        {
          ingredientId: input.ingredientId,
          zoneId: input.zoneId,
          quantity: input.quantity,
          unit: input.unit,
          movementType: input.movementType,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          unitCost: input.unitCost,
          totalCost: input.totalCost,
          performedBy: input.performedBy,
          reason: input.reason ?? null,
          remark: input.remark ?? null,
        },
      ],
      { session },
    );
    return doc.toObject();
  }

  findAll(filter: FindMovementsFilter): Promise<StockMovement[]> {
    const query: QueryFilter<StockMovementDocument> = {};
    if (filter.ingredientId) {
      query.ingredientId = filter.ingredientId;
    }
    if (filter.zoneId) {
      query.zoneId = filter.zoneId;
    } else if (filter.zoneIds) {
      query.zoneId = { $in: filter.zoneIds };
    }
    if (filter.movementType) {
      query.movementType = filter.movementType;
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.movementModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 200)
      .lean();
  }
}
