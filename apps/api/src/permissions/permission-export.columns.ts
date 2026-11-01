import type { ExportColumn } from '../export/export-column.interface';
import type { Permission } from './schemas/permission.schema';

const STATUS_LABEL: Record<Permission['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

export const PERMISSION_EXPORT_COLUMNS: Array<ExportColumn<Permission>> = [
  { key: 'code', header: 'รหัสสิทธิ์', value: (row) => row.code },
  { key: 'name', header: 'ชื่อสิทธิ์', value: (row) => row.name },
  { key: 'module', header: 'โมดูล', value: (row) => row.module },
  {
    key: 'description',
    header: 'คำอธิบาย',
    value: (row) => row.description || '-',
  },
  { key: 'status', header: 'สถานะ', value: (row) => STATUS_LABEL[row.status] },
];
