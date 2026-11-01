/** A column in an exported sheet: header text plus how to read the cell from a row. */
export interface ExcelColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
  width?: number
}

export type SheetCell = string | number | boolean | Date | null

/** Downloads `rows` as an .xlsx file. The writer library is loaded on demand to keep the main bundle small. */
export async function exportToExcel<T>(fileName: string, columns: Array<ExcelColumn<T>>, rows: T[]): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const header = columns.map((column) => ({ value: column.header, fontWeight: 'bold' as const }))
  const body = rows.map((row) => columns.map((column) => column.value(row) ?? null))
  await writeXlsxFile([header, ...body], {
    columns: columns.map((column) => ({ width: column.width ?? 18 })),
    stickyRowsCount: 1,
  }).toFile(fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

/** Reads the first sheet of an .xlsx file, or a .csv file, into rows of cells. */
export async function readSpreadsheet(file: File): Promise<SheetCell[][]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsv(await file.text())
  }
  const { readSheet } = await import('read-excel-file/browser')
  const rows = await readSheet(file)
  return rows.map((row) => row.map((cell) => (cell === undefined ? null : (cell as SheetCell))))
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF), tolerant of a UTF-8 BOM. Blank lines stay as empty rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const input = text.replace(/^﻿/, '')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (inQuotes) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') {
        index += 1
      }
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Blank lines are kept (as empty rows) so callers can report the sheet's real row numbers,
  // matching read-excel-file, which also keeps empty rows; callers skip blank rows themselves.
  return rows
}
