import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import {
  Ingredient,
  IngredientDocument,
} from '../ingredients/schemas/ingredient.schema';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
} from '../purchasing/schemas/purchase-order.schema';
import {
  Requisition,
  RequisitionDocument,
} from '../requisitions/schemas/requisition.schema';
import {
  StockMovement,
  StockMovementDocument,
} from '../stock-movements/schemas/stock-movement.schema';
import {
  Supplier,
  SupplierDocument,
} from '../suppliers/schemas/supplier.schema';
import {
  ZoneStock,
  ZoneStockDocument,
} from '../inventory/schemas/zone-stock.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Waste, WasteDocument } from '../waste/schemas/waste.schema';
import { Zone, ZoneDocument } from '../zones/schemas/zone.schema';

export const COMPARISON_PERIOD_TYPES = [
  'TODAY_VS_YESTERDAY',
  'THIS_WEEK_VS_LAST_WEEK',
  'THIS_MONTH_VS_LAST_MONTH',
  'THIS_YEAR_VS_LAST_YEAR',
  'CUSTOM',
] as const;
export type ComparisonPeriodType = (typeof COMPARISON_PERIOD_TYPES)[number];

export const COMPARISON_METRICS = [
  'STOCK_VALUE',
  'PURCHASE',
  'STOCK_USAGE',
  'REQUISITION',
  'WASTE',
  'TRANSFER',
  'ADJUSTMENT',
  'COST',
] as const;
export type ComparisonMetric = (typeof COMPARISON_METRICS)[number];

interface DateRange {
  from: Date;
  to: Date;
}

export interface ZoneReportRow {
  zoneId: string;
  zoneName: string;
  stockQuantity: number;
  stockValue: number;
  usageQuantity: number;
  usageValue: number;
  transfersIn: number;
  transfersOut: number;
  requisitionCount: number;
  requisitionValue: number;
}

interface FlowMetrics {
  purchase: number;
  stockUsage: number;
  waste: number;
  transfer: number;
  adjustment: number;
  cost: number;
  stockValueChange: number;
}

export interface InventoryReportRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantity: number;
  totalValue: number;
  minimumStock: number;
  maximumStock: number;
  stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';
  movementInQuantity: number;
  movementInValue: number;
  movementOutQuantity: number;
  movementOutValue: number;
}

export interface PurchaseReportSupplierRow {
  supplierId: string;
  supplierName: string;
  count: number;
  value: number;
}

export interface PurchaseReportIngredientRow {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  value: number;
}

export interface PurchaseReport {
  totals: {
    numberOfOrders: number;
    totalOrderedValue: number;
    totalReceivedValue: number;
  };
  bySupplier: PurchaseReportSupplierRow[];
  byIngredient: PurchaseReportIngredientRow[];
  trend: Array<{ date: string; value: number }>;
}

export interface WasteReportReasonRow {
  reason: string;
  quantity: number;
  value: number;
}

export interface WasteReportZoneRow {
  zoneId: string;
  zoneName: string;
  quantity: number;
  value: number;
}

export interface WasteReportIngredientRow {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  value: number;
}

export interface WasteReport {
  totals: {
    numberOfRecords: number;
    totalQuantity: number;
    totalValue: number;
    pendingCount: number;
  };
  byReason: WasteReportReasonRow[];
  byZone: WasteReportZoneRow[];
  byIngredient: WasteReportIngredientRow[];
  trend: Array<{ date: string; value: number }>;
}

export interface CostReportIngredientRow {
  ingredientId: string;
  ingredientName: string;
  cost: number;
}

export interface CostReportZoneRow {
  zoneId: string;
  zoneName: string;
  cost: number;
}

export interface CostReport {
  totalCost: number;
  byIngredient: CostReportIngredientRow[];
  byZone: CostReportZoneRow[];
  byMovementType: Array<{ movementType: string; cost: number }>;
  trend: Array<{ date: string; cost: number }>;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ZoneStock.name)
    private readonly zoneStockModel: Model<ZoneStockDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
    @InjectModel(Zone.name)
    private readonly zoneModel: Model<ZoneDocument>,
    @InjectModel(Requisition.name)
    private readonly requisitionModel: Model<RequisitionDocument>,
    @InjectModel(StockMovement.name)
    private readonly stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PurchaseOrder.name)
    private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(Waste.name)
    private readonly wasteModel: Model<WasteDocument>,
  ) {}

  async getZoneReport(
    dateFrom?: string,
    dateTo?: string,
    zoneId?: string,
  ): Promise<ZoneReportRow[]> {
    const range = this.resolveActivityRange(dateFrom, dateTo);
    const zoneMatch = zoneId ? { _id: new Types.ObjectId(zoneId) } : {};
    const zones = await this.zoneModel.find(zoneMatch).lean();

    const [
      stockByZone,
      usageByZone,
      transfersInByZone,
      transfersOutByZone,
      requisitionByZone,
    ] = await Promise.all([
      this.zoneStockModel.aggregate<{
        _id: Types.ObjectId;
        quantity: number;
        value: number;
      }>([
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
            _id: '$zoneId',
            quantity: { $sum: '$quantity' },
            value: {
              $sum: { $multiply: ['$quantity', '$ingredient.defaultCost'] },
            },
          },
        },
      ]),
      this.stockMovementModel.aggregate<{
        _id: Types.ObjectId;
        quantity: number;
        value: number;
      }>([
        {
          $match: {
            movementType: 'STOCK_OUT',
            createdAt: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: '$zoneId',
            quantity: { $sum: '$quantity' },
            value: { $sum: '$totalCost' },
          },
        },
      ]),
      this.stockMovementModel.aggregate<{ _id: Types.ObjectId; count: number }>(
        [
          {
            $match: {
              movementType: 'TRANSFER_IN',
              createdAt: { $gte: range.from, $lte: range.to },
            },
          },
          { $group: { _id: '$zoneId', count: { $sum: 1 } } },
        ],
      ),
      this.stockMovementModel.aggregate<{ _id: Types.ObjectId; count: number }>(
        [
          {
            $match: {
              movementType: 'TRANSFER_OUT',
              createdAt: { $gte: range.from, $lte: range.to },
            },
          },
          { $group: { _id: '$zoneId', count: { $sum: 1 } } },
        ],
      ),
      this.requisitionModel.aggregate<{
        _id: Types.ObjectId;
        count: number;
        value: number;
      }>([
        { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$toZoneId',
            count: { $addToSet: '$_id' },
            value: {
              $sum: {
                $multiply: ['$items.requestedQuantity', '$items.unitCost'],
              },
            },
          },
        },
        { $project: { count: { $size: '$count' }, value: 1 } },
      ]),
    ]);

    const stockMap = toMap(stockByZone);
    const usageMap = toMap(usageByZone);
    const transfersInMap = toCountMap(transfersInByZone);
    const transfersOutMap = toCountMap(transfersOutByZone);
    const requisitionMap = toMap(requisitionByZone);

    return zones.map((zone) => {
      const id = zone._id.toString();
      const stock = stockMap.get(id);
      const usage = usageMap.get(id);
      const requisitionRow = requisitionMap.get(id);
      return {
        zoneId: id,
        zoneName: zone.name,
        stockQuantity: round2(stock?.quantity ?? 0),
        stockValue: round2(stock?.value ?? 0),
        usageQuantity: round2(usage?.quantity ?? 0),
        usageValue: round2(usage?.value ?? 0),
        transfersIn: transfersInMap.get(id) ?? 0,
        transfersOut: transfersOutMap.get(id) ?? 0,
        requisitionCount: requisitionRow?.count ?? 0,
        requisitionValue: round2(requisitionRow?.value ?? 0),
      };
    });
  }

  async getRequisitionReport(
    dateFrom?: string,
    dateTo?: string,
    zoneId?: string,
  ) {
    const range = this.resolveActivityRange(dateFrom, dateTo);
    const match: Record<string, unknown> = {
      createdAt: { $gte: range.from, $lte: range.to },
    };
    if (zoneId) {
      match.toZoneId = new Types.ObjectId(zoneId);
    }

    const [facetResult] = await this.requisitionModel.aggregate<{
      totals: Array<{
        numberOfRequests: number;
        requestedItems: number;
        totalRequestedValue: number;
      }>;
      byIngredient: Array<{
        _id: Types.ObjectId;
        quantity: number;
        value: number;
      }>;
      byZone: Array<{ _id: Types.ObjectId; count: number; value: number }>;
      byUser: Array<{ _id: Types.ObjectId; count: number; value: number }>;
      trend: Array<{ _id: string; count: number }>;
    }>([
      { $match: match },
      {
        $facet: {
          totals: [
            { $unwind: '$items' },
            {
              $group: {
                _id: null,
                numberOfRequests: { $addToSet: '$_id' },
                requestedItems: { $sum: 1 },
                totalRequestedValue: {
                  $sum: {
                    $multiply: ['$items.requestedQuantity', '$items.unitCost'],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                numberOfRequests: { $size: '$numberOfRequests' },
                requestedItems: 1,
                totalRequestedValue: 1,
              },
            },
          ],
          byIngredient: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.ingredientId',
                quantity: { $sum: '$items.requestedQuantity' },
                value: {
                  $sum: {
                    $multiply: ['$items.requestedQuantity', '$items.unitCost'],
                  },
                },
              },
            },
            { $sort: { quantity: -1 } },
            { $limit: 10 },
          ],
          byZone: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$toZoneId',
                count: { $addToSet: '$_id' },
                value: {
                  $sum: {
                    $multiply: ['$items.requestedQuantity', '$items.unitCost'],
                  },
                },
              },
            },
            { $project: { count: { $size: '$count' }, value: 1 } },
            { $sort: { value: -1 } },
          ],
          byUser: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$requestedBy',
                count: { $addToSet: '$_id' },
                value: {
                  $sum: {
                    $multiply: ['$items.requestedQuantity', '$items.unitCost'],
                  },
                },
              },
            },
            { $project: { count: { $size: '$count' }, value: 1 } },
            { $sort: { value: -1 } },
          ],
          trend: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const [ingredients, zones, users] = await Promise.all([
      this.ingredientModel.find().select('name').lean(),
      this.zoneModel.find().select('name').lean(),
      this.userModel.find().select('username').lean(),
    ]);
    const ingredientNames = new Map(
      ingredients.map((i) => [i._id.toString(), i.name]),
    );
    const zoneNames = new Map(zones.map((z) => [z._id.toString(), z.name]));
    const userNames = new Map(users.map((u) => [u._id.toString(), u.username]));

    const totals = facetResult.totals[0] ?? {
      numberOfRequests: 0,
      requestedItems: 0,
      totalRequestedValue: 0,
    };
    const days = Math.max(
      1,
      Math.ceil(
        (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000),
      ),
    );

    return {
      numberOfRequests: totals.numberOfRequests,
      requestedItems: totals.requestedItems,
      totalRequestedValue: round2(totals.totalRequestedValue),
      averageRequestsPerDay: round2(totals.numberOfRequests / days),
      topRequestedIngredients: facetResult.byIngredient.map((row) => ({
        ingredientId: row._id.toString(),
        ingredientName: ingredientNames.get(row._id.toString()) ?? '-',
        quantity: round2(row.quantity),
        value: round2(row.value),
      })),
      requestsByZone: facetResult.byZone.map((row) => ({
        zoneId: row._id.toString(),
        zoneName: zoneNames.get(row._id.toString()) ?? '-',
        count: row.count,
        value: round2(row.value),
      })),
      requestsByUser: facetResult.byUser.map((row) => ({
        userId: row._id.toString(),
        username: userNames.get(row._id.toString()) ?? '-',
        count: row.count,
        value: round2(row.value),
      })),
      trend: facetResult.trend.map((row) => ({
        date: row._id,
        count: row.count,
      })),
    };
  }

  async getInventoryReport(
    dateFrom?: string,
    dateTo?: string,
    zoneId?: string,
  ): Promise<InventoryReportRow[]> {
    const range = this.resolveActivityRange(dateFrom, dateTo);
    const stockMatch: Record<string, unknown> = {};
    const movementZoneFilter: Record<string, unknown> = {};
    if (zoneId) {
      const zoneObjectId = new Types.ObjectId(zoneId);
      stockMatch.zoneId = zoneObjectId;
      movementZoneFilter.zoneId = zoneObjectId;
    }

    const [
      stockByIngredient,
      movementInByIngredient,
      movementOutByIngredient,
      ingredients,
    ] = await Promise.all([
      this.zoneStockModel.aggregate<{
        _id: Types.ObjectId;
        quantity: number;
        value: number;
      }>([
        { $match: stockMatch },
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
            _id: '$ingredientId',
            quantity: { $sum: '$quantity' },
            value: {
              $sum: { $multiply: ['$quantity', '$ingredient.defaultCost'] },
            },
          },
        },
      ]),
      this.stockMovementModel.aggregate<{
        _id: Types.ObjectId;
        quantity: number;
        value: number;
      }>([
        {
          $match: {
            movementType: { $in: ['STOCK_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN'] },
            createdAt: { $gte: range.from, $lte: range.to },
            ...movementZoneFilter,
          },
        },
        {
          $group: {
            _id: '$ingredientId',
            quantity: { $sum: '$quantity' },
            value: { $sum: '$totalCost' },
          },
        },
      ]),
      this.stockMovementModel.aggregate<{
        _id: Types.ObjectId;
        quantity: number;
        value: number;
      }>([
        {
          $match: {
            movementType: {
              $in: ['STOCK_OUT', 'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'WASTE'],
            },
            createdAt: { $gte: range.from, $lte: range.to },
            ...movementZoneFilter,
          },
        },
        {
          $group: {
            _id: '$ingredientId',
            quantity: { $sum: '$quantity' },
            value: { $sum: '$totalCost' },
          },
        },
      ]),
      this.ingredientModel
        .find({ status: 'ACTIVE' })
        .populate<{ baseUnitId: { code: string } | null }>('baseUnitId', 'code')
        .lean(),
    ]);

    const stockMap = toMap(stockByIngredient);
    const movementInMap = toMap(movementInByIngredient);
    const movementOutMap = toMap(movementOutByIngredient);

    return ingredients.map((ingredient) => {
      const id = ingredient._id.toString();
      const stock = stockMap.get(id);
      const movementIn = movementInMap.get(id);
      const movementOut = movementOutMap.get(id);
      const totalQuantity = round2(stock?.quantity ?? 0);
      const stockStatus: InventoryReportRow['stockStatus'] =
        totalQuantity <= 0
          ? 'OUT_OF_STOCK'
          : totalQuantity < ingredient.minimumStock
            ? 'LOW_STOCK'
            : 'NORMAL';
      return {
        ingredientId: id,
        ingredientName: ingredient.name,
        unit: ingredient.baseUnitId?.code ?? '-',
        totalQuantity,
        totalValue: round2(stock?.value ?? 0),
        minimumStock: ingredient.minimumStock,
        maximumStock: ingredient.maximumStock,
        stockStatus,
        movementInQuantity: round2(movementIn?.quantity ?? 0),
        movementInValue: round2(movementIn?.value ?? 0),
        movementOutQuantity: round2(movementOut?.quantity ?? 0),
        movementOutValue: round2(movementOut?.value ?? 0),
      };
    });
  }

  async getPurchaseReport(
    dateFrom?: string,
    dateTo?: string,
    supplierId?: string,
  ): Promise<PurchaseReport> {
    const range = this.resolveActivityRange(dateFrom, dateTo);
    const orderMatch: Record<string, unknown> = {
      createdAt: { $gte: range.from, $lte: range.to },
      status: { $nin: ['CANCELLED', 'REJECTED'] },
    };
    if (supplierId) {
      orderMatch.supplierId = new Types.ObjectId(supplierId);
    }

    const movementMatch: Record<string, unknown> = {
      referenceType: 'PURCHASE_ORDER',
      movementType: 'STOCK_IN',
      createdAt: { $gte: range.from, $lte: range.to },
    };
    if (supplierId) {
      const supplierOrders = await this.purchaseOrderModel
        .find({ supplierId: new Types.ObjectId(supplierId) })
        .select('_id')
        .lean();
      movementMatch.referenceId = { $in: supplierOrders.map((o) => o._id) };
    }

    const [[facetResult], receivedResult, trendResult, ingredients, suppliers] =
      await Promise.all([
        this.purchaseOrderModel.aggregate<{
          totals: Array<{ numberOfOrders: number; totalOrderedValue: number }>;
          bySupplier: Array<{
            _id: Types.ObjectId;
            count: number;
            value: number;
          }>;
          byIngredient: Array<{
            _id: Types.ObjectId;
            quantity: number;
            value: number;
          }>;
        }>([
          { $match: orderMatch },
          {
            $facet: {
              totals: [
                { $unwind: '$items' },
                {
                  $group: {
                    _id: null,
                    numberOfOrders: { $addToSet: '$_id' },
                    totalOrderedValue: {
                      $sum: {
                        $multiply: [
                          '$items.orderedQuantity',
                          '$items.unitCost',
                        ],
                      },
                    },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    numberOfOrders: { $size: '$numberOfOrders' },
                    totalOrderedValue: 1,
                  },
                },
              ],
              bySupplier: [
                { $unwind: '$items' },
                {
                  $group: {
                    _id: '$supplierId',
                    count: { $addToSet: '$_id' },
                    value: {
                      $sum: {
                        $multiply: [
                          '$items.orderedQuantity',
                          '$items.unitCost',
                        ],
                      },
                    },
                  },
                },
                { $project: { count: { $size: '$count' }, value: 1 } },
                { $sort: { value: -1 } },
              ],
              byIngredient: [
                { $unwind: '$items' },
                {
                  $group: {
                    _id: '$items.ingredientId',
                    quantity: { $sum: '$items.orderedQuantity' },
                    value: {
                      $sum: {
                        $multiply: [
                          '$items.orderedQuantity',
                          '$items.unitCost',
                        ],
                      },
                    },
                  },
                },
                { $sort: { value: -1 } },
                { $limit: 10 },
              ],
            },
          },
        ]),
        this.stockMovementModel.aggregate<{ total: number }>([
          { $match: movementMatch },
          { $group: { _id: null, total: { $sum: '$totalCost' } } },
        ]),
        this.stockMovementModel.aggregate<{ _id: string; value: number }>([
          { $match: movementMatch },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              value: { $sum: '$totalCost' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.ingredientModel.find().select('name').lean(),
        this.supplierModel.find().select('name').lean(),
      ]);

    const ingredientNames = new Map(
      ingredients.map((i) => [i._id.toString(), i.name]),
    );
    const supplierNames = new Map(
      suppliers.map((s) => [s._id.toString(), s.name]),
    );
    const totals = facetResult.totals[0] ?? {
      numberOfOrders: 0,
      totalOrderedValue: 0,
    };

    return {
      totals: {
        numberOfOrders: totals.numberOfOrders,
        totalOrderedValue: round2(totals.totalOrderedValue),
        totalReceivedValue: round2(receivedResult[0]?.total ?? 0),
      },
      bySupplier: facetResult.bySupplier.map((row) => ({
        supplierId: row._id.toString(),
        supplierName: supplierNames.get(row._id.toString()) ?? '-',
        count: row.count,
        value: round2(row.value),
      })),
      byIngredient: facetResult.byIngredient.map((row) => ({
        ingredientId: row._id.toString(),
        ingredientName: ingredientNames.get(row._id.toString()) ?? '-',
        quantity: round2(row.quantity),
        value: round2(row.value),
      })),
      trend: trendResult.map((row) => ({
        date: row._id,
        value: round2(row.value),
      })),
    };
  }

  async getWasteReport(
    dateFrom?: string,
    dateTo?: string,
    zoneId?: string,
  ): Promise<WasteReport> {
    const range = this.resolveActivityRange(dateFrom, dateTo);
    const approvedMatch: Record<string, unknown> = {
      status: 'APPROVED',
      createdAt: { $gte: range.from, $lte: range.to },
    };
    const pendingMatch: Record<string, unknown> = {
      status: 'PENDING_APPROVAL',
      createdAt: { $gte: range.from, $lte: range.to },
    };
    if (zoneId) {
      const zoneObjectId = new Types.ObjectId(zoneId);
      approvedMatch.zoneId = zoneObjectId;
      pendingMatch.zoneId = zoneObjectId;
    }

    const [[facetResult], pendingCount, ingredients, zones] = await Promise.all(
      [
        this.wasteModel.aggregate<{
          totals: Array<{
            numberOfRecords: number;
            totalQuantity: number;
            totalValue: number;
          }>;
          byReason: Array<{ _id: string; quantity: number; value: number }>;
          byZone: Array<{
            _id: Types.ObjectId;
            quantity: number;
            value: number;
          }>;
          byIngredient: Array<{
            _id: Types.ObjectId;
            quantity: number;
            value: number;
          }>;
          trend: Array<{ _id: string; value: number }>;
        }>([
          { $match: approvedMatch },
          {
            $facet: {
              totals: [
                {
                  $group: {
                    _id: null,
                    numberOfRecords: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                    totalValue: {
                      $sum: { $multiply: ['$quantity', '$unitCost'] },
                    },
                  },
                },
              ],
              byReason: [
                {
                  $group: {
                    _id: '$reason',
                    quantity: { $sum: '$quantity' },
                    value: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
                  },
                },
              ],
              byZone: [
                {
                  $group: {
                    _id: '$zoneId',
                    quantity: { $sum: '$quantity' },
                    value: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
                  },
                },
              ],
              byIngredient: [
                {
                  $group: {
                    _id: '$ingredientId',
                    quantity: { $sum: '$quantity' },
                    value: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
                  },
                },
                { $sort: { value: -1 } },
                { $limit: 10 },
              ],
              trend: [
                {
                  $group: {
                    _id: {
                      $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    value: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
                  },
                },
                { $sort: { _id: 1 } },
              ],
            },
          },
        ]),
        this.wasteModel.countDocuments(pendingMatch),
        this.ingredientModel.find().select('name').lean(),
        this.zoneModel.find().select('name').lean(),
      ],
    );

    const ingredientNames = new Map(
      ingredients.map((i) => [i._id.toString(), i.name]),
    );
    const zoneNames = new Map(zones.map((z) => [z._id.toString(), z.name]));
    const totals = facetResult.totals[0] ?? {
      numberOfRecords: 0,
      totalQuantity: 0,
      totalValue: 0,
    };

    return {
      totals: {
        numberOfRecords: totals.numberOfRecords,
        totalQuantity: round2(totals.totalQuantity),
        totalValue: round2(totals.totalValue),
        pendingCount,
      },
      byReason: facetResult.byReason.map((row) => ({
        reason: row._id,
        quantity: round2(row.quantity),
        value: round2(row.value),
      })),
      byZone: facetResult.byZone.map((row) => ({
        zoneId: row._id.toString(),
        zoneName: zoneNames.get(row._id.toString()) ?? '-',
        quantity: round2(row.quantity),
        value: round2(row.value),
      })),
      byIngredient: facetResult.byIngredient.map((row) => ({
        ingredientId: row._id.toString(),
        ingredientName: ingredientNames.get(row._id.toString()) ?? '-',
        quantity: round2(row.quantity),
        value: round2(row.value),
      })),
      trend: facetResult.trend.map((row) => ({
        date: row._id,
        value: round2(row.value),
      })),
    };
  }

  async getCostReport(
    dateFrom?: string,
    dateTo?: string,
    zoneId?: string,
  ): Promise<CostReport> {
    const range = this.resolveActivityRange(dateFrom, dateTo);
    const match: Record<string, unknown> = {
      movementType: { $in: ['STOCK_OUT', 'WASTE', 'ADJUSTMENT_OUT'] },
      createdAt: { $gte: range.from, $lte: range.to },
    };
    if (zoneId) {
      match.zoneId = new Types.ObjectId(zoneId);
    }

    const [[facetResult], ingredients, zones] = await Promise.all([
      this.stockMovementModel.aggregate<{
        total: Array<{ total: number }>;
        byIngredient: Array<{ _id: Types.ObjectId; cost: number }>;
        byZone: Array<{ _id: Types.ObjectId; cost: number }>;
        byMovementType: Array<{ _id: string; cost: number }>;
        trend: Array<{ _id: string; cost: number }>;
      }>([
        { $match: match },
        {
          $facet: {
            total: [{ $group: { _id: null, total: { $sum: '$totalCost' } } }],
            byIngredient: [
              {
                $group: { _id: '$ingredientId', cost: { $sum: '$totalCost' } },
              },
              { $sort: { cost: -1 } },
              { $limit: 10 },
            ],
            byZone: [
              { $group: { _id: '$zoneId', cost: { $sum: '$totalCost' } } },
            ],
            byMovementType: [
              {
                $group: { _id: '$movementType', cost: { $sum: '$totalCost' } },
              },
            ],
            trend: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                  },
                  cost: { $sum: '$totalCost' },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),
      this.ingredientModel.find().select('name').lean(),
      this.zoneModel.find().select('name').lean(),
    ]);

    const ingredientNames = new Map(
      ingredients.map((i) => [i._id.toString(), i.name]),
    );
    const zoneNames = new Map(zones.map((z) => [z._id.toString(), z.name]));

    return {
      totalCost: round2(facetResult.total[0]?.total ?? 0),
      byIngredient: facetResult.byIngredient.map((row) => ({
        ingredientId: row._id.toString(),
        ingredientName: ingredientNames.get(row._id.toString()) ?? '-',
        cost: round2(row.cost),
      })),
      byZone: facetResult.byZone.map((row) => ({
        zoneId: row._id.toString(),
        zoneName: zoneNames.get(row._id.toString()) ?? '-',
        cost: round2(row.cost),
      })),
      byMovementType: facetResult.byMovementType.map((row) => ({
        movementType: row._id,
        cost: round2(row.cost),
      })),
      trend: facetResult.trend.map((row) => ({
        date: row._id,
        cost: round2(row.cost),
      })),
    };
  }

  async getComparisonReport(
    periodType: ComparisonPeriodType,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const { current, previous } = this.resolvePeriods(
      periodType,
      dateFrom,
      dateTo,
    );

    const [currentFlow, previousFlow, currentRequisition, previousRequisition] =
      await Promise.all([
        this.getFlowMetrics(current),
        this.getFlowMetrics(previous),
        this.getRequisitionValue(current),
        this.getRequisitionValue(previous),
      ]);

    const currentValues: Record<ComparisonMetric, number> = {
      STOCK_VALUE: currentFlow.stockValueChange,
      PURCHASE: currentFlow.purchase,
      STOCK_USAGE: currentFlow.stockUsage,
      REQUISITION: currentRequisition,
      WASTE: currentFlow.waste,
      TRANSFER: currentFlow.transfer,
      ADJUSTMENT: currentFlow.adjustment,
      COST: currentFlow.cost,
    };
    const previousValues: Record<ComparisonMetric, number> = {
      STOCK_VALUE: previousFlow.stockValueChange,
      PURCHASE: previousFlow.purchase,
      STOCK_USAGE: previousFlow.stockUsage,
      REQUISITION: previousRequisition,
      WASTE: previousFlow.waste,
      TRANSFER: previousFlow.transfer,
      ADJUSTMENT: previousFlow.adjustment,
      COST: previousFlow.cost,
    };

    return {
      current: { from: current.from, to: current.to },
      previous: { from: previous.from, to: previous.to },
      metrics: COMPARISON_METRICS.map((metric) => {
        const currentValue = round2(currentValues[metric]);
        const previousValue = round2(previousValues[metric]);
        const difference = round2(currentValue - previousValue);
        const percentageChange =
          previousValue === 0
            ? currentValue === 0
              ? 0
              : 100
            : round2((difference / previousValue) * 100);
        return {
          metric,
          currentValue,
          previousValue,
          difference,
          percentageChange,
        };
      }),
    };
  }

  private async getFlowMetrics(range: DateRange): Promise<FlowMetrics> {
    const match = { createdAt: { $gte: range.from, $lte: range.to } };
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $facet: {
          purchase: [
            {
              $match: {
                referenceType: 'PURCHASE_ORDER',
                movementType: 'STOCK_IN',
              },
            },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ],
          stockUsage: [
            { $match: { movementType: 'STOCK_OUT' } },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ],
          waste: [
            { $match: { movementType: 'WASTE' } },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ],
          transfer: [
            { $match: { movementType: 'TRANSFER_OUT' } },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ],
          adjustment: [
            {
              $match: {
                movementType: { $in: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ],
          cost: [
            {
              $match: {
                movementType: { $in: ['STOCK_OUT', 'WASTE', 'ADJUSTMENT_OUT'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ],
          // Net change in stock value during the period (all IN types add, all OUT types
          // subtract). Deliberately built only from movements' own totalCost snapshots --
          // never from ingredient.defaultCost -- so it stays correct even after ingredient
          // costs are edited later; a reconstruction that mixed historical movement costs
          // with today's defaultCost produced wildly wrong figures.
          stockValueChange: [
            {
              $group: {
                _id: null,
                total: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          '$movementType',
                          ['STOCK_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN'],
                        ],
                      },
                      '$totalCost',
                      { $multiply: ['$totalCost', -1] },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ];
    const [result] = await this.stockMovementModel.aggregate<{
      purchase: Array<{ total: number }>;
      stockUsage: Array<{ total: number }>;
      waste: Array<{ total: number }>;
      transfer: Array<{ total: number }>;
      adjustment: Array<{ total: number }>;
      cost: Array<{ total: number }>;
      stockValueChange: Array<{ total: number }>;
    }>(pipeline);

    return {
      purchase: result.purchase[0]?.total ?? 0,
      stockUsage: result.stockUsage[0]?.total ?? 0,
      waste: result.waste[0]?.total ?? 0,
      transfer: result.transfer[0]?.total ?? 0,
      adjustment: result.adjustment[0]?.total ?? 0,
      cost: result.cost[0]?.total ?? 0,
      stockValueChange: result.stockValueChange[0]?.total ?? 0,
    };
  }

  private async getRequisitionValue(range: DateRange): Promise<number> {
    const [result] = await this.requisitionModel.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: ['$items.requestedQuantity', '$items.unitCost'],
            },
          },
        },
      },
    ]);
    return result?.total ?? 0;
  }

  private resolveActivityRange(dateFrom?: string, dateTo?: string): DateRange {
    const built = buildDateRangeQuery(dateFrom, dateTo);
    if (built?.$gte && built?.$lte) {
      return { from: built.$gte, to: built.$lte };
    }
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: built?.$gte ?? defaultFrom, to: built?.$lte ?? now };
  }

  private resolvePeriods(
    periodType: ComparisonPeriodType,
    dateFrom?: string,
    dateTo?: string,
  ): { current: DateRange; previous: DateRange } {
    const now = new Date();

    if (periodType === 'CUSTOM') {
      const built = buildDateRangeQuery(dateFrom, dateTo);
      if (!built?.$gte || !built?.$lte) {
        throw new BadRequestException(
          'ต้องระบุ dateFrom และ dateTo สำหรับช่วงเวลาแบบกำหนดเอง',
        );
      }
      const current = { from: built.$gte, to: built.$lte };
      const durationMs = current.to.getTime() - current.from.getTime();
      const previous = {
        from: new Date(current.from.getTime() - durationMs),
        to: new Date(current.from.getTime() - 1),
      };
      return { current, previous };
    }

    if (periodType === 'TODAY_VS_YESTERDAY') {
      const currentFrom = startOfDay(now);
      const previousFrom = addDays(currentFrom, -1);
      const elapsedMs = now.getTime() - currentFrom.getTime();
      return {
        current: { from: currentFrom, to: now },
        previous: {
          from: previousFrom,
          to: new Date(previousFrom.getTime() + elapsedMs),
        },
      };
    }

    if (periodType === 'THIS_WEEK_VS_LAST_WEEK') {
      const currentFrom = startOfWeek(now);
      const previousFrom = addDays(currentFrom, -7);
      const elapsedMs = now.getTime() - currentFrom.getTime();
      return {
        current: { from: currentFrom, to: now },
        previous: {
          from: previousFrom,
          to: new Date(previousFrom.getTime() + elapsedMs),
        },
      };
    }

    if (periodType === 'THIS_MONTH_VS_LAST_MONTH') {
      const currentFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const elapsedMs = now.getTime() - currentFrom.getTime();
      return {
        current: { from: currentFrom, to: now },
        previous: {
          from: previousFrom,
          to: new Date(previousFrom.getTime() + elapsedMs),
        },
      };
    }

    // THIS_YEAR_VS_LAST_YEAR
    const currentFrom = new Date(now.getFullYear(), 0, 1);
    const previousFrom = new Date(now.getFullYear() - 1, 0, 1);
    const elapsedMs = now.getTime() - currentFrom.getTime();
    return {
      current: { from: currentFrom, to: now },
      previous: {
        from: previousFrom,
        to: new Date(previousFrom.getTime() + elapsedMs),
      },
    };
  }
}

function toMap<T extends { _id: Types.ObjectId }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row._id.toString(), row]));
}

function toCountMap(
  rows: Array<{ _id: Types.ObjectId; count: number }>,
): Map<string, number> {
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday-start week
  return addDays(startOfDay(date), -diff);
}
