import type { ExportColumn } from '../export/export-column.interface';
import type { Category } from './schemas/category.schema';

const STATUS_LABEL: Record<Category['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

/** Transliterated from apps/web/src/pages/master-data/CategoriesPage.tsx's `columns` array. */
export const CATEGORY_EXPORT_COLUMNS: Array<ExportColumn<Category>> = [
  { key: 'code', header: 'รหัส', value: (row) => row.code },
  { key: 'name', header: 'ชื่อหมวดหมู่', value: (row) => row.name },
  { key: 'status', header: 'สถานะ', value: (row) => STATUS_LABEL[row.status] },
];
