import type { ExportColumn } from '../export/export-column.interface';
import { formatExportCurrency } from '../export/format.util';
import type { Ingredient } from './schemas/ingredient.schema';

const STATUS_LABEL: Record<Ingredient['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

/** Transliterated from apps/web/src/pages/master-data/IngredientsPage.tsx's `columns` array. */
export function buildIngredientExportColumns(
  categoryMap: Map<string, string>,
  unitMap: Map<string, string>,
): Array<ExportColumn<Ingredient>> {
  return [
    { key: 'code', header: 'รหัส', value: (row) => row.code },
    { key: 'name', header: 'ชื่อวัตถุดิบ', value: (row) => row.name },
    {
      key: 'category',
      header: 'หมวดหมู่',
      value: (row) => categoryMap.get(row.categoryId.toString()) ?? '-',
    },
    {
      key: 'unit',
      header: 'หน่วยนับ',
      value: (row) => unitMap.get(row.baseUnitId.toString()) ?? '-',
    },
    {
      key: 'cost',
      header: 'ต้นทุน/หน่วย',
      value: (row) => formatExportCurrency(row.defaultCost),
      align: 'right',
    },
    {
      key: 'min',
      header: 'ขั้นต่ำ',
      value: (row) => row.minimumStock,
      align: 'right',
    },
    {
      key: 'max',
      header: 'สูงสุด',
      value: (row) => row.maximumStock,
      align: 'right',
    },
    {
      key: 'status',
      header: 'สถานะ',
      value: (row) => STATUS_LABEL[row.status],
    },
  ];
}
