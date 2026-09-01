import type { ExportColumn } from '../export/export-column.interface';
import {
  formatExportDateTime,
  formatExportNumber,
} from '../export/format.util';
import type {
  MovementType,
  StockMovement,
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
};

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
      key: 'reason',
      header: 'เหตุผล/หมายเหตุ',
      value: (row) => row.reason ?? row.remark ?? '-',
    },
  ];
}
