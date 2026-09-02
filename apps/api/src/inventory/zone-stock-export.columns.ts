import type { Ingredient } from '../ingredients/schemas/ingredient.schema';
import type { ExportColumn } from '../export/export-column.interface';
import { formatExportNumber } from '../export/format.util';
import type { ZoneStock } from './schemas/zone-stock.schema';

const STOCK_LEVEL_LABEL = {
  OUT_OF_STOCK: 'หมดสต๊อก',
  LOW_STOCK: 'ใกล้หมด',
  NORMAL: 'ปกติ',
} as const;

function stockLevel(
  quantity: number,
  minimumStock: number,
): keyof typeof STOCK_LEVEL_LABEL {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= minimumStock) return 'LOW_STOCK';
  return 'NORMAL';
}

/** Transliterated from apps/web/src/pages/inventory/StockBalancePage.tsx's `columns` array. */
export function buildZoneStockExportColumns(
  ingredientMap: Map<string, Ingredient>,
  zoneMap: Map<string, string>,
  unitMap: Map<string, string>,
): Array<ExportColumn<ZoneStock>> {
  return [
    {
      key: 'ingredient',
      header: 'วัตถุดิบ',
      value: (row) =>
        ingredientMap.get(row.ingredientId.toString())?.name ?? '-',
    },
    {
      key: 'zone',
      header: 'Zone',
      value: (row) => zoneMap.get(row.zoneId.toString()) ?? '-',
    },
    {
      key: 'quantity',
      header: 'จำนวนคงเหลือ',
      value: (row) => {
        const ingredient = ingredientMap.get(row.ingredientId.toString());
        const unitName = ingredient
          ? (unitMap.get(ingredient.baseUnitId.toString()) ?? '')
          : '';
        return `${formatExportNumber(row.quantity)} ${unitName}`.trim();
      },
      align: 'right',
    },
    {
      key: 'level',
      header: 'สถานะสต๊อก',
      value: (row) => {
        const ingredient = ingredientMap.get(row.ingredientId.toString());
        if (!ingredient) return '-';
        return STOCK_LEVEL_LABEL[
          stockLevel(row.quantity, ingredient.minimumStock)
        ];
      },
    },
  ];
}
