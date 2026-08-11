import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Ingredient,
  IngredientDocument,
} from '../ingredients/schemas/ingredient.schema';
import {
  Requisition,
  RequisitionDocument,
} from '../requisitions/schemas/requisition.schema';
import {
  ZoneStock,
  ZoneStockDocument,
} from '../inventory/schemas/zone-stock.schema';
import {
  Transfer,
  TransferDocument,
} from '../transfers/schemas/transfer.schema';
import {
  StockCount,
  StockCountDocument,
} from '../stock-counts/schemas/stock-count.schema';

export interface DashboardSummary {
  inventory: {
    stockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  requisition: {
    requestsToday: number;
    requestsThisMonth: number;
    pendingRequests: number;
    topRequestingZone: {
      zoneId: string;
      zoneName: string;
      count: number;
    } | null;
  };
  operations: {
    pendingApprovals: number;
    pendingTransfers: number;
    stockCountStatus: Record<string, number>;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(ZoneStock.name)
    private readonly zoneStockModel: Model<ZoneStockDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
    @InjectModel(Requisition.name)
    private readonly requisitionModel: Model<RequisitionDocument>,
    @InjectModel(Transfer.name)
    private readonly transferModel: Model<TransferDocument>,
    @InjectModel(StockCount.name)
    private readonly stockCountModel: Model<StockCountDocument>,
  ) {}

  async getOwnerSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      inventory,
      requestsToday,
      requestsThisMonth,
      pendingRequests,
      topZone,
      pendingTransfers,
      stockCountStatus,
    ] = await Promise.all([
      this.getInventorySummary(),
      this.requisitionModel.countDocuments({ createdAt: { $gte: startOfDay } }),
      this.requisitionModel.countDocuments({
        createdAt: { $gte: startOfMonth },
      }),
      this.requisitionModel.countDocuments({ status: 'PENDING' }),
      this.getTopRequestingZone(startOfMonth),
      this.transferModel.countDocuments({ status: 'PENDING' }),
      this.getStockCountStatus(),
    ]);

    return {
      inventory,
      requisition: {
        requestsToday,
        requestsThisMonth,
        pendingRequests,
        topRequestingZone: topZone,
      },
      operations: {
        pendingApprovals: pendingRequests,
        pendingTransfers,
        stockCountStatus,
      },
    };
  }

  private async getInventorySummary(): Promise<DashboardSummary['inventory']> {
    const [valueResult, stockLevels] = await Promise.all([
      this.zoneStockModel.aggregate<{ totalValue: number }>([
        {
          $lookup: {
            from: 'ingredients',
            localField: 'ingredientId',
            foreignField: '_id',
            as: 'ingredient',
          },
        },
        { $unwind: '$ingredient' },
        {
          $group: {
            _id: null,
            totalValue: {
              $sum: { $multiply: ['$quantity', '$ingredient.defaultCost'] },
            },
          },
        },
      ]),
      this.ingredientModel.aggregate<{
        minimumStock: number;
        totalQuantity: number;
      }>([
        { $match: { status: 'ACTIVE' } },
        {
          $lookup: {
            from: 'zoneStocks',
            localField: '_id',
            foreignField: 'ingredientId',
            as: 'stocks',
          },
        },
        {
          $project: {
            minimumStock: 1,
            totalQuantity: { $sum: '$stocks.quantity' },
          },
        },
      ]),
    ]);

    const lowStockCount = stockLevels.filter(
      (level) =>
        level.totalQuantity > 0 && level.totalQuantity <= level.minimumStock,
    ).length;
    const outOfStockCount = stockLevels.filter(
      (level) => level.totalQuantity <= 0,
    ).length;

    return {
      stockValue: round2(valueResult[0]?.totalValue ?? 0),
      lowStockCount,
      outOfStockCount,
    };
  }

  private async getTopRequestingZone(
    since: Date,
  ): Promise<{ zoneId: string; zoneName: string; count: number } | null> {
    const [result] = await this.requisitionModel.aggregate<{
      zoneId: string;
      zoneName: string;
      count: number;
    }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$toZoneId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'zones',
          localField: '_id',
          foreignField: '_id',
          as: 'zone',
        },
      },
      { $unwind: '$zone' },
      {
        $project: { _id: 0, zoneId: '$_id', zoneName: '$zone.name', count: 1 },
      },
    ]);
    return result ?? null;
  }

  private async getStockCountStatus(): Promise<Record<string, number>> {
    const results = await this.stockCountModel.aggregate<{
      _id: string;
      count: number;
    }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    return Object.fromEntries(results.map((r) => [r._id, r.count]));
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
