import { stringify } from 'csv-stringify/sync';
import type { ExportColumn } from './export-column.interface';

/** Excel misdetects encoding and mojibakes Thai text without a leading UTF-8 BOM. */
const UTF8_BOM = '﻿';

export function buildCsv<T>(
  rows: T[],
  columns: Array<ExportColumn<T>>,
): Buffer {
  const header = columns.map((column) => column.header);
  const body = rows.map((row) =>
    columns.map((column) => column.value(row) ?? ''),
  );
  const csv = stringify([header, ...body]);
  return Buffer.from(UTF8_BOM + csv, 'utf-8');
}
