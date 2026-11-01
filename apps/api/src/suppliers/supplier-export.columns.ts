import type { ExportColumn } from '../export/export-column.interface';
import type { Supplier } from './schemas/supplier.schema';

const STATUS_LABEL: Record<Supplier['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

/** Transliterated from apps/web/src/pages/master-data/SuppliersPage.tsx's `columns` array. */
export const SUPPLIER_EXPORT_COLUMNS: Array<ExportColumn<Supplier>> = [
  { key: 'code', header: 'รหัส', value: (row) => row.code },
  { key: 'name', header: 'ชื่อ Supplier', value: (row) => row.name },
  {
    key: 'contactName',
    header: 'ผู้ติดต่อ',
    value: (row) => row.contactName || '-',
  },
  { key: 'phone', header: 'เบอร์โทร', value: (row) => row.phone || '-' },
  { key: 'status', header: 'สถานะ', value: (row) => STATUS_LABEL[row.status] },
];
