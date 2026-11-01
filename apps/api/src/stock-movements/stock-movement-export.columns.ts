import type { ExportColumn } from '../export/export-column.interface';
import {
  formatExportDateTime,
  formatExportNumber,
} from '../export/format.util';
import type {
  MovementType,
  StockMovement,
  StockOutReason,
} from './schemas/stock-movement.schema';

const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  STOCK_IN: 'รับสินค้า',
  STOCK_OUT: 'จ่ายสินค้า',
  TRANSFER_IN: 'รับโอน',
  TRANSFER_OUT: 'โอนออก',
  ADJUSTMENT_IN: 'ปรับเพิ่ม',
  ADJUSTMENT_OUT: 'ปรับลด',
  WASTE: 'ของเสีย',
  AUTO_DEDUCTION: 'หักอัตโนมัติ',
  PRODUCTION_IN: 'ได้จากแปรรูป',
  PRODUCTION_OUT: 'ใช้แปรรูป',
};

const STOCK_OUT_REASON_LABEL: Record<StockOutReason, string> = {
  KITCHEN_USE: 'ใช้ในครัว/ร้าน',
  SALE: 'ขาย',
  STAFF_MEAL: 'อาหารพนักงาน',
  COMPLIMENTARY: 'ของแถม/รับรอง',
  OTHER: 'อื่นๆ',
};

function reasonLabel(reason: string | null): string | null {
  return reason && reason in STOCK_OUT_REASON_LABEL
    ? STOCK_OUT_REASON_LABEL[reason as StockOutReason]
    : reason;
}

/** `timestamps: true` adds `createdAt` at runtime without it being a declared class field. */
type MovementWithTimestamp = StockMovement & { createdAt: Date };

/** Transliterated from apps/web/src/pages/inventory/MovementsPage.tsx's `columns` array. */
export function buildStockMovementExportColumns(
  ingredientMap: Map<string, string>,
  zoneMap: Map<string, string>,
): Array<ExportColumn<MovementWithTimestamp>> {
  return [
    {
      key: 'date',
      header: 'วันที่',
      value: (row) => formatExportDateTime(row.createdAt),
    },
    {
      key: 'ingredient',
      header: 'วัตถุดิบ',
      value: (row) => ingredientMap.get(row.ingredientId.toString()) ?? '-',
    },
    {
      key: 'zone',
      header: 'Zone',
      value: (row) => zoneMap.get(row.zoneId.toString()) ?? '-',
    },
    {
      key: 'type',
      header: 'ประเภท',
      value: (row) => MOVEMENT_TYPE_LABEL[row.movementType],
    },
    {
      key: 'quantity',
      header: 'จำนวน',
      value: (row) => `${formatExportNumber(row.quantity)} ${row.unit}`,
      align: 'right',
    },
    {
      key: 'input',
      header: 'บันทึกเป็น',
      value: (row) =>
        row.inputUnit &&
        row.inputUnit !== row.unit &&
        row.inputQuantity !== null
          ? `${formatExportNumber(row.inputQuantity)} ${row.inputUnit}`
          : '-',
      align: 'right',
    },
    {
      key: 'reason',
      header: 'เหตุผล/หมายเหตุ',
      value: (row) => reasonLabel(row.reason) ?? row.remark ?? '-',
    },
  ];
}
