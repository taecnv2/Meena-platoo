import type { ExportColumn } from '../export/export-column.interface';
import { formatExportDateTime } from '../export/format.util';
import type {
  Requisition,
  RequisitionStatus,
} from './schemas/requisition.schema';

const STATUS_LABEL: Record<RequisitionStatus, string> = {
  DRAFT: 'ร่าง',
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  PARTIALLY_FULFILLED: 'จ่ายบางส่วน',
  FULFILLED: 'จ่ายครบแล้ว',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
};

/** `timestamps: true` adds `createdAt` at runtime without it being a declared class field. */
type RequisitionWithTimestamp = Requisition & { createdAt: Date };

/** Transliterated from apps/web/src/pages/requisitions/RequisitionsListPage.tsx's `columns` array. */
export function buildRequisitionExportColumns(
  zoneMap: Map<string, string>,
): Array<ExportColumn<RequisitionWithTimestamp>> {
  return [
    { key: 'code', header: 'เลขที่', value: (row) => row.code },
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
      header: 'จำนวนรายการ',
      value: (row) => row.items.length,
      align: 'right',
    },
    {
      key: 'status',
      header: 'สถานะ',
      value: (row) => STATUS_LABEL[row.status],
    },
  ];
}
