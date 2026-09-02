import type { ExportColumn } from '../export/export-column.interface';
import type { Unit, UnitType } from './schemas/unit.schema';

const STATUS_LABEL: Record<Unit['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  WEIGHT: 'น้ำหนัก',
  VOLUME: 'ปริมาตร',
  COUNT: 'นับจำนวน',
  OTHER: 'อื่นๆ',
};

/** Transliterated from apps/web/src/pages/master-data/UnitsPage.tsx's `columns` array. */
export const UNIT_EXPORT_COLUMNS: Array<ExportColumn<Unit>> = [
  { key: 'code', header: 'รหัส', value: (row) => row.code },
  { key: 'name', header: 'ชื่อหน่วยนับ', value: (row) => row.name },
  { key: 'type', header: 'ประเภท', value: (row) => UNIT_TYPE_LABEL[row.type] },
  { key: 'status', header: 'สถานะ', value: (row) => STATUS_LABEL[row.status] },
];
