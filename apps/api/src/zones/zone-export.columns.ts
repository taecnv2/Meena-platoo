import type { ExportColumn } from '../export/export-column.interface';
import type { Zone, ZoneType } from './schemas/zone.schema';

const STATUS_LABEL: Record<Zone['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  KITCHEN: 'ครัว',
  FRONT_OF_HOUSE: 'หน้าร้าน',
  STORAGE: 'คลังสินค้า',
  COLD_STORAGE: 'ห้องเย็น',
  OTHER: 'อื่นๆ',
};

/** Transliterated from apps/web/src/pages/master-data/ZonesPage.tsx's `columns` array. */
export const ZONE_EXPORT_COLUMNS: Array<ExportColumn<Zone>> = [
  { key: 'code', header: 'รหัส', value: (row) => row.code },
  { key: 'name', header: 'ชื่อ Zone', value: (row) => row.name },
  { key: 'type', header: 'ประเภท', value: (row) => ZONE_TYPE_LABEL[row.type] },
  { key: 'status', header: 'สถานะ', value: (row) => STATUS_LABEL[row.status] },
];
