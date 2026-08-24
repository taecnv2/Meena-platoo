import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
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
import {
  StockMovement,
  StockMovementDocument,
} from '../stock-movements/schemas/stock-movement.schema';
import { Waste, WasteDocument } from '../waste/schemas/waste.schema';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
} from '../purchasing/schemas/purchase-order.schema';

export interface DashboardSummary {
  inventory: {
    stockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  purchasing: {
    today: number;
    thisMonth: number;
    changePercent: number;
  };
  requisition: {
    today: number;
    thisMonth: number;
    requestsInRange: number;
    pendingRequests: number;
    topRequestingZone: {
      zoneId: string;
      zoneName: string;
      count: number;
    } | null;
  };
  waste: {
    today: number;
    thisMonth: number;
    changePercent: number;
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
    @InjectModel(StockMovement.name)
    private readonly stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(Waste.name)
    private readonly wasteModel: Model<WasteDocument>,
    @InjectModel(PurchaseOrder.name)
    private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
  ) {}

  async getOwnerSummary(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<DashboardSummary> {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const range = buildDateRangeQuery(dateFrom, dateTo) ?? {
      $gte: defaultFrom,
      $lte: now,
    };

    const [
      inventory,
      requestsInRange,
      requestsToday,
      requestsThisMonth,
      pendingRequests,
      pendingPurchaseOrders,
      pendingWaste,
      topZone,
      pendingTransfers,
      stockCountStatus,
      purchasing,
      waste,
    ] = await Promise.all([
      this.getInventorySummary(),
      this.requisitionModel.countDocuments({ createdAt: range }),
      this.requisitionModel.countDocuments({ createdAt: this.todayRange(now) }),
      this.requisitionModel.countDocuments({
        createdAt: { $gte: defaultFrom, $lte: now },
      }),
      this.requisitionModel.countDocuments({ status: 'PENDING' }),
      this.purchaseOrderModel.countDocuments({ status: 'PENDING' }),
      this.wasteModel.countDocuments({ status: 'PENDING_APPROVAL' }),
      this.getTopRequestingZone(range),
      this.transferModel.countDocuments({ status: 'PENDING' }),
      this.getStockCountStatus(range),
      this.getPurchasingSummary(now, defaultFrom),
      this.getWasteSummary(now, defaultFrom),
    ]);

    return {
      inventory,
      purchasing,
      requisition: {
        today: requestsToday,
        thisMonth: requestsThisMonth,
        requestsInRange,
        pendingRequests,
        topRequestingZone: topZone,
      },
      waste,
      operations: {
        pendingApprovals:
          pendingRequests + pendingPurchaseOrders + pendingWaste,
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

  private async getTopRequestingZone(range: {
    $gte?: Date;
    $lte?: Date;
  }): Promise<{ zoneId: string; zoneName: string; count: number } | null> {
    const [result] = await this.requisitionModel.aggregate<{
      zoneId: string;
      zoneName: string;
      count: number;
    }>([
      { $match: { createdAt: range } },
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

  private async getStockCountStatus(range: {
    $gte?: Date;
    $lte?: Date;
  }): Promise<Record<string, number>> {
    const results = await this.stockCountModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { createdAt: range } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(results.map((r) => [r._id, r.count]));
  }

  private async getPurchasingSummary(
    now: Date,
    firstOfMonth: Date,
  ): Promise<DashboardSummary['purchasing']> {
    const [today, thisMonth, lastMonthElapsed] = await Promise.all([
      this.sumMovementCost(
        { referenceType: 'PURCHASE_ORDER', movementType: 'STOCK_IN' },
        this.todayRange(now),
      ),
      this.sumMovementCost(
        { referenceType: 'PURCHASE_ORDER', movementType: 'STOCK_IN' },
        { $gte: firstOfMonth, $lte: now },
      ),
      this.sumMovementCost(
        { referenceType: 'PURCHASE_ORDER', movementType: 'STOCK_IN' },
        this.lastMonthElapsedRange(now, firstOfMonth),
      ),
    ]);
    return {
      today: round2(today),
      thisMonth: round2(thisMonth),
      changePercent: percentChange(thisMonth, lastMonthElapsed),
    };
  }

  private async getWasteSummary(
    now: Date,
    firstOfMonth: Date,
  ): Promise<DashboardSummary['waste']> {
    const [today, thisMonth, lastMonthElapsed] = await Promise.all([
      this.sumMovementCost({ movementType: 'WASTE' }, this.todayRange(now)),
      this.sumMovementCost(
        { movementType: 'WASTE' },
        { $gte: firstOfMonth, $lte: now },
      ),
      this.sumMovementCost(
        { movementType: 'WASTE' },
        this.lastMonthElapsedRange(now, firstOfMonth),
      ),
    ]);
    return {
      today: round2(today),
      thisMonth: round2(thisMonth),
      changePercent: percentChange(thisMonth, lastMonthElapsed),
    };
  }

  private async sumMovementCost(
    match: Record<string, unknown>,
    createdAt: { $gte?: Date; $lte?: Date },
  ): Promise<number> {
    const [result] = await this.stockMovementModel.aggregate<{
      total: number;
    }>([
      { $match: { ...match, createdAt } },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ]);
    return result?.total ?? 0;
  }

  private todayRange(now: Date): { $gte: Date; $lte: Date } {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      $lte: now,
    };
  }

  /** Last month, cut off at the same elapsed duration as "this month so far" -- for a fair change%. */
  private lastMonthElapsedRange(
    now: Date,
    firstOfMonth: Date,
  ): { $gte: Date; $lte: Date } {
    const firstOfLastMonth = new Date(
      firstOfMonth.getFullYear(),
      firstOfMonth.getMonth() - 1,
      1,
    );
    const elapsedMs = now.getTime() - firstOfMonth.getTime();
    return {
      $gte: firstOfLastMonth,
      $lte: new Date(firstOfLastMonth.getTime() + elapsedMs),
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return round2(((current - previous) / previous) * 100);
}
