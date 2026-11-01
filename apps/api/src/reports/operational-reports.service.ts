import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import {
  Ingredient,
  IngredientDocument,
} from '../ingredients/schemas/ingredient.schema';
import {
  ZoneStock,
  ZoneStockDocument,
} from '../inventory/schemas/zone-stock.schema';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
} from '../purchasing/schemas/purchase-order.schema';
import {
  IN_MOVEMENT_TYPES,
  MovementType,
  OUT_MOVEMENT_TYPES,
  StockMovement,
  StockMovementDocument,
} from '../stock-movements/schemas/stock-movement.schema';
import {
  Supplier,
  SupplierDocument,
} from '../suppliers/schemas/supplier.schema';
import { Zone, ZoneDocument } from '../zones/schemas/zone.schema';
import {
  buildLedgerBalances,
  DailyFlow,
  LedgerDay,
  listDays,
} from './ledger.util';

const MAX_LEDGER_DAYS = 62;
const TRANSFER_TYPES: MovementType[] = ['TRANSFER_IN', 'TRANSFER_OUT'];

export interface LedgerRow {
  ingredientId: string;
  code: string;
  name: string;
  categoryName: string;
  unit: string;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  days: LedgerDay[];
}

export interface LedgerReport {
  zoneId: string | null;
  dateFrom: string;
  dateTo: string;
  days: string[];
  rows: LedgerRow[];
}

export interface SupplierStatementLine {
  date: Date;
  ingredientCode: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  amount: number;
  invoiceNo: string | null;
  reference: string;
  zoneName: string;
}

export interface SupplierStatement {
  supplier: {
    _id: string;
    code: string;
    name: string;
    contactName: string;
    phone: string;
    address: string;
  };
  dateFrom: string | null;
  dateTo: string | null;
  lines: SupplierStatementLine[];
  totalAmount: number;
}

export interface ConsignmentItemRow {
  ingredientId: string;
  code: string;
  name: string;
  unit: string;
  /** Stock at the start of the range (all zones). */
  opening: number;
  /** Every stock increase except transfers: deliveries, imports/adjustments, production. */
  received: number;
  sold: number;
  soldValue: number;
  otherOut: number;
  /** Stock at the end of the range (all zones). */
  balance: number;
  balanceValue: number;
}

export interface ConsignmentOwnerReport {
  owner: string;
  items: ConsignmentItemRow[];
  totalSoldValue: number;
  totalBalanceValue: number;
}

type IngredientWithUnitCode = Ingredient & {
  _id: Types.ObjectId;
  baseUnitId: { code: string } | null;
};

/**
 * Reports that mirror the restaurant's old spreadsheets: the daily stock ledger, the supplier
 * billing statement (ใบวางบิล) and the consignment (ฝากขาย) sales summary.
 */
@Injectable()
export class OperationalReportsService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(ZoneStock.name)
    private readonly zoneStockModel: Model<ZoneStockDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(PurchaseOrder.name)
    private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    @InjectModel(Zone.name) private readonly zoneModel: Model<ZoneDocument>,
  ) {}

  async getLedger(params: {
    dateFrom?: string;
    dateTo?: string;
    zoneId?: string;
    categoryId?: string;
  }): Promise<LedgerReport> {
    const { dateFrom, dateTo } = params;
    const range = buildDateRangeQuery(dateFrom, dateTo);
    if (!dateFrom || !dateTo || !range?.$gte || !range.$lte) {
      throw new BadRequestException('กรุณาระบุช่วงวันที่ (dateFrom, dateTo)');
    }
    const days = listDays(dateFrom, dateTo);
    if (days.length === 0 || days.length > MAX_LEDGER_DAYS) {
      throw new BadRequestException(
        `ช่วงวันที่ต้องไม่เกิน ${MAX_LEDGER_DAYS} วัน`,
      );
    }

    for (const id of [params.zoneId, params.categoryId]) {
      if (id && !Types.ObjectId.isValid(id)) {
        throw new BadRequestException('ตัวกรอง Zone หรือหมวดหมู่ไม่ถูกต้อง');
      }
    }
    const ingredientFilter: Record<string, unknown> = {};
    if (params.categoryId) {
      ingredientFilter.categoryId = new Types.ObjectId(params.categoryId);
    }
    const [ingredients, categories] = await Promise.all([
      this.ingredientModel
        .find(ingredientFilter)
        .populate<{ baseUnitId: { code: string } | null }>('baseUnitId', 'code')
        .lean<IngredientWithUnitCode[]>(),
      this.categoryModel.find().select('name').lean(),
    ]);
    const ingredientIds = ingredients.map((ingredient) => ingredient._id);
    const zoneMatch = params.zoneId
      ? { zoneId: new Types.ObjectId(params.zoneId) }
      : {};
    // Restaurant-wide (no zone) a transfer is just a move between zones -- it nets to zero,
    // so it is left out instead of inflating both the in and out columns.
    const typeMatch = params.zoneId
      ? {}
      : { movementType: { $nin: TRANSFER_TYPES } };
    const signedQuantity = {
      $cond: [
        { $in: ['$movementType', IN_MOVEMENT_TYPES] },
        '$quantity',
        { $multiply: ['$quantity', -1] },
      ],
    };
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const [balances, after, flows] = await Promise.all([
      this.zoneStockModel.aggregate<{ _id: Types.ObjectId; quantity: number }>([
        { $match: { ingredientId: { $in: ingredientIds }, ...zoneMatch } },
        { $group: { _id: '$ingredientId', quantity: { $sum: '$quantity' } } },
      ]),
      this.movementModel.aggregate<{ _id: Types.ObjectId; net: number }>([
        {
          $match: {
            ingredientId: { $in: ingredientIds },
            createdAt: { $gt: range.$lte },
            ...zoneMatch,
            ...typeMatch,
          },
        },
        { $group: { _id: '$ingredientId', net: { $sum: signedQuantity } } },
      ]),
      this.movementModel.aggregate<{
        _id: { ingredientId: Types.ObjectId; day: string };
        in: number;
        out: number;
      }>([
        {
          $match: {
            ingredientId: { $in: ingredientIds },
            createdAt: { $gte: range.$gte, $lte: range.$lte },
            ...zoneMatch,
            ...typeMatch,
          },
        },
        {
          $group: {
            _id: {
              ingredientId: '$ingredientId',
              day: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone,
                },
              },
            },
            in: {
              $sum: {
                $cond: [
                  { $in: ['$movementType', IN_MOVEMENT_TYPES] },
                  '$quantity',
                  0,
                ],
              },
            },
            out: {
              $sum: {
                $cond: [
                  { $in: ['$movementType', OUT_MOVEMENT_TYPES] },
                  '$quantity',
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const balanceMap = new Map(
      balances.map((row) => [row._id.toString(), row.quantity]),
    );
    const afterMap = new Map(after.map((row) => [row._id.toString(), row.net]));
    const flowMap = new Map<string, Map<string, DailyFlow>>();
    for (const row of flows) {
      const id = row._id.ingredientId.toString();
      const byDay = flowMap.get(id) ?? new Map<string, DailyFlow>();
      byDay.set(row._id.day, { in: row.in, out: row.out });
      flowMap.set(id, byDay);
    }
    const categoryNames = new Map(
      categories.map((category) => [category._id.toString(), category.name]),
    );

    const rows: LedgerRow[] = [];
    for (const ingredient of ingredients) {
      const id = ingredient._id.toString();
      const ledger = buildLedgerBalances(
        balanceMap.get(id) ?? 0,
        afterMap.get(id) ?? 0,
        days,
        flowMap.get(id) ?? new Map<string, DailyFlow>(),
      );
      const isEmpty =
        ledger.opening === 0 &&
        ledger.closing === 0 &&
        ledger.totalIn === 0 &&
        ledger.totalOut === 0;
      if (isEmpty) {
        continue;
      }
      rows.push({
        ingredientId: id,
        code: ingredient.code,
        name: ingredient.name,
        categoryName:
          categoryNames.get(ingredient.categoryId.toString()) ?? '-',
        unit: ingredient.baseUnitId?.code ?? '-',
        ...ledger,
      });
    }
    rows.sort(
      (a, b) =>
        a.categoryName.localeCompare(b.categoryName, 'th') ||
        a.name.localeCompare(b.name, 'th'),
    );

    return {
      zoneId: params.zoneId ?? null,
      dateFrom,
      dateTo,
      days,
      rows,
    };
  }

  async getSupplierStatement(params: {
    supplierId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SupplierStatement> {
    if (!params.supplierId || !Types.ObjectId.isValid(params.supplierId)) {
      throw new BadRequestException('กรุณาเลือกผู้จำหน่าย');
    }
    const supplierObjectId = new Types.ObjectId(params.supplierId);
    const supplier = await this.supplierModel.findById(supplierObjectId).lean();
    if (!supplier) {
      throw new BadRequestException('ไม่พบผู้จำหน่ายนี้');
    }
    const orders = await this.purchaseOrderModel
      .find({ supplierId: supplierObjectId })
      .select('code')
      .lean();
    const orderCodes = new Map(
      orders.map((order) => [order._id.toString(), order.code]),
    );

    const match: Record<string, unknown> = {
      movementType: 'STOCK_IN',
      $or: [
        { supplierId: supplierObjectId },
        // PO receipts recorded before movements carried supplierId.
        {
          supplierId: null,
          referenceType: 'PURCHASE_ORDER',
          referenceId: { $in: orders.map((order) => order._id) },
        },
      ],
    };
    const createdAt = buildDateRangeQuery(params.dateFrom, params.dateTo);
    if (createdAt) {
      match.createdAt = createdAt;
    }

    const [movements, ingredients, zones] = await Promise.all([
      this.movementModel
        .find(match)
        .sort({ createdAt: 1 })
        .lean<Array<StockMovement & { createdAt: Date }>>(),
      this.ingredientModel.find().select('code name').lean(),
      this.zoneModel.find().select('name').lean(),
    ]);
    const ingredientMap = new Map(
      ingredients.map((ingredient) => [ingredient._id.toString(), ingredient]),
    );
    const zoneNames = new Map(
      zones.map((zone) => [zone._id.toString(), zone.name]),
    );

    const lines = movements.map((movement) => {
      const ingredient = ingredientMap.get(movement.ingredientId.toString());
      const quantity = movement.inputQuantity ?? movement.quantity;
      const reference =
        movement.referenceType === 'PURCHASE_ORDER' && movement.referenceId
          ? (orderCodes.get(movement.referenceId.toString()) ?? 'ใบสั่งซื้อ')
          : 'รับสินค้า';
      return {
        date: movement.createdAt,
        ingredientCode: ingredient?.code ?? '-',
        ingredientName: ingredient?.name ?? '-',
        quantity,
        unit: movement.inputUnit ?? movement.unit,
        unitCost: quantity > 0 ? round2(movement.totalCost / quantity) : 0,
        amount: round2(movement.totalCost),
        invoiceNo: movement.invoiceNo ?? null,
        reference,
        zoneName: zoneNames.get(movement.zoneId.toString()) ?? '-',
      };
    });

    return {
      supplier: {
        _id: supplier._id.toString(),
        code: supplier.code,
        name: supplier.name,
        contactName: supplier.contactName,
        phone: supplier.phone,
        address: supplier.address,
      },
      dateFrom: params.dateFrom ?? null,
      dateTo: params.dateTo ?? null,
      lines,
      totalAmount: round2(lines.reduce((sum, line) => sum + line.amount, 0)),
    };
  }

  /**
   * Consignment stock is reported restaurant-wide, so transfers between zones are left out.
   * Columns reconcile: opening + received - sold - otherOut = balance (at the end of the range),
   * with opening rebuilt from today's stock the same way as the ledger.
   */
  async getConsignmentReport(params: {
    dateFrom?: string;
    dateTo?: string;
    owner?: string;
  }): Promise<ConsignmentOwnerReport[]> {
    const ingredientFilter: Record<string, unknown> = {
      consignmentOwner: params.owner?.trim() || { $ne: null },
    };
    const ingredients = await this.ingredientModel
      .find(ingredientFilter)
      .populate<{ baseUnitId: { code: string } | null }>('baseUnitId', 'code')
      .lean<IngredientWithUnitCode[]>();
    const ingredientIds = ingredients.map((ingredient) => ingredient._id);

    const baseMatch = {
      ingredientId: { $in: ingredientIds },
      movementType: { $nin: TRANSFER_TYPES },
    };
    const range = buildDateRangeQuery(params.dateFrom, params.dateTo);
    const inRangeMatch = range ? { ...baseMatch, createdAt: range } : baseMatch;
    const signedQuantity = {
      $cond: [
        { $in: ['$movementType', IN_MOVEMENT_TYPES] },
        '$quantity',
        { $multiply: ['$quantity', -1] },
      ],
    };

    const [flows, after, balances] = await Promise.all([
      this.movementModel.aggregate<{
        _id: Types.ObjectId;
        received: number;
        sold: number;
        soldValue: number;
        otherOut: number;
      }>([
        { $match: inRangeMatch },
        {
          $group: {
            _id: '$ingredientId',
            received: {
              $sum: {
                $cond: [
                  { $in: ['$movementType', IN_MOVEMENT_TYPES] },
                  '$quantity',
                  0,
                ],
              },
            },
            sold: { $sum: { $cond: [isSale(), '$quantity', 0] } },
            soldValue: { $sum: { $cond: [isSale(), '$totalCost', 0] } },
            otherOut: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$movementType', OUT_MOVEMENT_TYPES] },
                      { $not: [isSale()] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
          },
        },
      ]),
      range?.$lte
        ? this.movementModel.aggregate<{ _id: Types.ObjectId; net: number }>([
            { $match: { ...baseMatch, createdAt: { $gt: range.$lte } } },
            { $group: { _id: '$ingredientId', net: { $sum: signedQuantity } } },
          ])
        : Promise.resolve([] as Array<{ _id: Types.ObjectId; net: number }>),
      this.zoneStockModel.aggregate<{ _id: Types.ObjectId; quantity: number }>([
        { $match: { ingredientId: { $in: ingredientIds } } },
        { $group: { _id: '$ingredientId', quantity: { $sum: '$quantity' } } },
      ]),
    ]);
    const flowMap = new Map(flows.map((row) => [row._id.toString(), row]));
    const afterMap = new Map(after.map((row) => [row._id.toString(), row.net]));
    const balanceMap = new Map(
      balances.map((row) => [row._id.toString(), row.quantity]),
    );

    const byOwner = new Map<string, ConsignmentItemRow[]>();
    for (const ingredient of ingredients) {
      const id = ingredient._id.toString();
      const flow = flowMap.get(id);
      const received = flow?.received ?? 0;
      const sold = flow?.sold ?? 0;
      const otherOut = flow?.otherOut ?? 0;
      const closing = (balanceMap.get(id) ?? 0) - (afterMap.get(id) ?? 0);
      const opening = closing - (received - sold - otherOut);
      const owner = ingredient.consignmentOwner ?? '-';
      const items = byOwner.get(owner) ?? [];
      items.push({
        ingredientId: id,
        code: ingredient.code,
        name: ingredient.name,
        unit: ingredient.baseUnitId?.code ?? '-',
        opening: round2(opening),
        received: round2(received),
        sold: round2(sold),
        soldValue: round2(flow?.soldValue ?? 0),
        otherOut: round2(otherOut),
        balance: round2(closing),
        balanceValue: round2(closing * ingredient.defaultCost),
      });
      byOwner.set(owner, items);
    }

    return [...byOwner.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'th'))
      .map(([owner, items]) => ({
        owner,
        items: items.sort((a, b) => a.name.localeCompare(b.name, 'th')),
        totalSoldValue: round2(
          items.reduce((sum, item) => sum + item.soldValue, 0),
        ),
        totalBalanceValue: round2(
          items.reduce((sum, item) => sum + item.balanceValue, 0),
        ),
      }));
  }
}

function isSale() {
  return {
    $and: [
      { $eq: ['$movementType', 'STOCK_OUT'] },
      { $eq: ['$reason', 'SALE'] },
    ],
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
