import type { ExportColumn } from '../export/export-column.interface';
import {
  formatExportCurrency,
  formatExportNumber,
} from '../export/format.util';
import type {
  ComparisonMetric,
  CostReportIngredientRow,
  InventoryReportRow,
  PurchaseReportIngredientRow,
  WasteReportIngredientRow,
  ZoneReportRow,
} from './reports.service';

const STOCK_STATUS_LABEL: Record<InventoryReportRow['stockStatus'], string> = {
  OUT_OF_STOCK: 'หมดสต๊อก',
  LOW_STOCK: 'ใกล้หมด',
  NORMAL: 'ปกติ',
};

/** Transliterated from apps/web/src/pages/reports/InventoryReportPage.tsx's `columns` array. */
export const INVENTORY_REPORT_EXPORT_COLUMNS: Array<
  ExportColumn<InventoryReportRow>
> = [
  { key: 'ingredient', header: 'วัตถุดิบ', value: (row) => row.ingredientName },
  {
    key: 'quantity',
    header: 'จำนวนคงเหลือ',
    value: (row) => `${formatExportNumber(row.totalQuantity)} ${row.unit}`,
    align: 'right',
  },
  {
    key: 'value',
    header: 'มูลค่าคงเหลือ',
    value: (row) => formatExportCurrency(row.totalValue),
    align: 'right',
  },
  {
    key: 'status',
    header: 'สถานะสต๊อก',
    value: (row) => STOCK_STATUS_LABEL[row.stockStatus],
  },
  {
    key: 'in',
    header: 'รับเข้า',
    value: (row) => `${formatExportNumber(row.movementInQuantity)} ${row.unit}`,
    align: 'right',
  },
  {
    key: 'out',
    header: 'จ่ายออก',
    value: (row) =>
      `${formatExportNumber(row.movementOutQuantity)} ${row.unit}`,
    align: 'right',
  },
];

/** Transliterated from apps/web/src/pages/reports/ZoneReportPage.tsx's `columns` array. */
export const ZONE_REPORT_EXPORT_COLUMNS: Array<ExportColumn<ZoneReportRow>> = [
  { key: 'zone', header: 'Zone', value: (row) => row.zoneName },
  {
    key: 'stockQuantity',
    header: 'สต๊อกคงเหลือ',
    value: (row) => formatExportNumber(row.stockQuantity),
    align: 'right',
  },
  {
    key: 'stockValue',
    header: 'มูลค่าสต๊อก',
    value: (row) => formatExportCurrency(row.stockValue),
    align: 'right',
  },
  {
    key: 'usageValue',
    header: 'มูลค่าที่ใช้ไป',
    value: (row) => formatExportCurrency(row.usageValue),
    align: 'right',
  },
  {
    key: 'transfersIn',
    header: 'โอนเข้า',
    value: (row) => formatExportNumber(row.transfersIn),
    align: 'right',
  },
  {
    key: 'transfersOut',
    header: 'โอนออก',
    value: (row) => formatExportNumber(row.transfersOut),
    align: 'right',
  },
  {
    key: 'requisitionCount',
    header: 'จำนวนใบเบิก',
    value: (row) => formatExportNumber(row.requisitionCount),
    align: 'right',
  },
  {
    key: 'requisitionValue',
    header: 'มูลค่าใบเบิก',
    value: (row) => formatExportCurrency(row.requisitionValue),
    align: 'right',
  },
];

/**
 * Requisition/Purchase/Waste/Cost reports return a nested breakdown object (totals + several
 * by-X arrays), not a single flat row array -- there is no one natural "the" table. Export
 * focuses on each report's richest per-ingredient breakdown (the detail a spreadsheet is best
 * at), with the scalar totals surfaced in the PDF/CSV meta line instead of as export rows.
 */
interface IngredientBreakdownRow {
  ingredientName: string;
  quantity: number;
  value: number;
}

export const REQUISITION_REPORT_EXPORT_COLUMNS: Array<
  ExportColumn<IngredientBreakdownRow>
> = [
  { key: 'ingredient', header: 'วัตถุดิบ', value: (row) => row.ingredientName },
  {
    key: 'quantity',
    header: 'จำนวน',
    value: (row) => formatExportNumber(row.quantity),
    align: 'right',
  },
  {
    key: 'value',
    header: 'มูลค่า',
    value: (row) => formatExportCurrency(row.value),
    align: 'right',
  },
];

export const PURCHASE_REPORT_EXPORT_COLUMNS: Array<
  ExportColumn<PurchaseReportIngredientRow>
> = [
  { key: 'ingredient', header: 'วัตถุดิบ', value: (row) => row.ingredientName },
  {
    key: 'quantity',
    header: 'จำนวนสั่งซื้อ',
    value: (row) => formatExportNumber(row.quantity),
    align: 'right',
  },
  {
    key: 'value',
    header: 'มูลค่า',
    value: (row) => formatExportCurrency(row.value),
    align: 'right',
  },
];

export const WASTE_REPORT_EXPORT_COLUMNS: Array<
  ExportColumn<WasteReportIngredientRow>
> = [
  { key: 'ingredient', header: 'วัตถุดิบ', value: (row) => row.ingredientName },
  {
    key: 'quantity',
    header: 'จำนวน',
    value: (row) => formatExportNumber(row.quantity),
    align: 'right',
  },
  {
    key: 'value',
    header: 'มูลค่า',
    value: (row) => formatExportCurrency(row.value),
    align: 'right',
  },
];

export const COST_REPORT_EXPORT_COLUMNS: Array<
  ExportColumn<CostReportIngredientRow>
> = [
  { key: 'ingredient', header: 'วัตถุดิบ', value: (row) => row.ingredientName },
  {
    key: 'cost',
    header: 'ต้นทุนที่ใช้ไป',
    value: (row) => formatExportCurrency(row.cost),
    align: 'right',
  },
];

const COMPARISON_METRIC_LABEL: Record<ComparisonMetric, string> = {
  STOCK_VALUE: 'มูลค่าสต๊อกที่เปลี่ยนแปลง',
  PURCHASE: 'มูลค่าการจัดซื้อ',
  STOCK_USAGE: 'มูลค่าการเบิกใช้',
  REQUISITION: 'มูลค่าการเบิกสินค้า',
  WASTE: 'มูลค่าของเสีย',
  TRANSFER: 'มูลค่าการโอนสินค้า',
  ADJUSTMENT: 'มูลค่าการปรับปรุงสต๊อก',
  COST: 'ต้นทุนที่ใช้ไป',
};

interface ComparisonMetricRow {
  metric: ComparisonMetric;
  currentValue: number;
  previousValue: number;
  difference: number;
  percentageChange: number;
}

export const COMPARISON_REPORT_EXPORT_COLUMNS: Array<
  ExportColumn<ComparisonMetricRow>
> = [
  {
    key: 'metric',
    header: 'ตัวชี้วัด',
    value: (row) => COMPARISON_METRIC_LABEL[row.metric],
  },
  {
    key: 'current',
    header: 'ช่วงปัจจุบัน',
    value: (row) => formatExportCurrency(row.currentValue),
    align: 'right',
  },
  {
    key: 'previous',
    header: 'ช่วงก่อนหน้า',
    value: (row) => formatExportCurrency(row.previousValue),
    align: 'right',
  },
  {
    key: 'difference',
    header: 'ผลต่าง',
    value: (row) => formatExportCurrency(row.difference),
    align: 'right',
  },
  {
    key: 'percentageChange',
    header: '% เปลี่ยนแปลง',
    value: (row) => `${formatExportNumber(row.percentageChange)}%`,
    align: 'right',
  },
];
