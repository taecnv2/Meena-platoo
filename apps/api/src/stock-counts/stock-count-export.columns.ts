import type { ExportColumn } from '../export/export-column.interface';
import { formatExportDateTime } from '../export/format.util';
import type {
  StockCount,
  StockCountStatus,
} from './schemas/stock-count.schema';

const STATUS_LABEL: Record<StockCountStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  CANCELLED: 'ยกเลิก',
};

/** `timestamps: true` adds `createdAt` at runtime without it being a declared class field. */
type StockCountWithTimestamp = StockCount & { createdAt: Date };

/** Transliterated from apps/web/src/pages/stock-counts/StockCountsPage.tsx's `columns` array. */
export function buildStockCountExportColumns(
  zoneMap: Map<string, string>,
  ingredientMap: Map<string, string>,
): Array<ExportColumn<StockCountWithTimestamp>> {
  return [
    { key: 'code', header: 'เลขที่', value: (row) => row.code },
    {
      key: 'date',
      header: 'วันที่',
      value: (row) => formatExportDateTime(row.createdAt),
    },
    {
      key: 'zone',
      header: 'Zone',
      value: (row) => zoneMap.get(row.zoneId.toString()) ?? '-',
    },
    {
      key: 'items',
      header: 'รายการ',
      value: (row) =>
        row.items
          .map((item) => ingredientMap.get(item.ingredientId.toString()) ?? '-')
          .join(', '),
    },
    {
      key: 'status',
      header: 'สถานะ',
      value: (row) => STATUS_LABEL[row.status],
    },
  ];
}
