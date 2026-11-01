import type { ExportColumn } from '../export/export-column.interface';
import {
  formatExportDateTime,
  formatExportNumber,
} from '../export/format.util';
import type { Transfer, TransferStatus } from './schemas/transfer.schema';

const STATUS_LABEL: Record<TransferStatus, string> = {
  PENDING: 'รอดำเนินการ',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
};

/** `timestamps: true` adds `createdAt` at runtime without it being a declared class field. */
type TransferWithTimestamp = Transfer & { createdAt: Date };

/** Transliterated from apps/web/src/pages/inventory/TransfersPage.tsx's `columns` array. */
export function buildTransferExportColumns(
  zoneMap: Map<string, string>,
  ingredientMap: Map<string, string>,
): Array<ExportColumn<TransferWithTimestamp>> {
  return [
    {
      key: 'date',
      header: 'วันที่',
      value: (row) => formatExportDateTime(row.createdAt),
    },
    {
      key: 'from',
      header: 'จาก',
      value: (row) => zoneMap.get(row.fromZoneId.toString()) ?? '-',
    },
    {
      key: 'to',
      header: 'ถึง',
      value: (row) => zoneMap.get(row.toZoneId.toString()) ?? '-',
    },
    {
      key: 'items',
      header: 'รายการ',
      value: (row) =>
        row.items
          .map(
            (item) =>
              `${ingredientMap.get(item.ingredientId.toString()) ?? '-'} (${formatExportNumber(item.quantity)} ${item.unit})`,
          )
          .join(', '),
    },
    {
      key: 'status',
      header: 'สถานะ',
      value: (row) => STATUS_LABEL[row.status],
    },
  ];
}
