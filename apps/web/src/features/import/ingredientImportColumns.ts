import type { ImportIngredientRow } from '@/types/entities'
import type { SheetCell } from '@/utils/excel'

/** Spreadsheet-backed fields (rowNumber is added by the mapper, not read from a column). */
export type ImportField = Exclude<keyof ImportIngredientRow, 'rowNumber'>

interface ImportColumn {
  field: ImportField
  /** Canonical Thai header used in the downloadable template. */
  header: string
  /** Other header spellings accepted on upload (compared case/space-insensitively). */
  aliases: string[]
  numeric?: boolean
  required?: boolean
  example: [string | number, string | number]
}

/**
 * Column contract for the ingredient import template (also documented in docs/USER_GUIDE.md).
 * Order here is the template's column order.
 */
export const INGREDIENT_IMPORT_COLUMNS: ImportColumn[] = [
  { field: 'code', header: 'รหัส', aliases: ['code', 'รหัสวัตถุดิบ'], example: ['', 'BEER-SINGHA'] },
  {
    field: 'name',
    header: 'ชื่อวัตถุดิบ',
    aliases: ['name', 'ชื่อ', 'รายการ', 'รายการวัตถุดิบ'],
    required: true,
    example: ['หมึกไข่ (ถุง)', 'เบียร์สิงห์'],
  },
  { field: 'category', header: 'หมวดหมู่', aliases: ['category'], required: true, example: ['ของสด', 'เครื่องดื่ม'] },
  {
    field: 'baseUnit',
    header: 'หน่วยหลัก',
    aliases: ['baseUnit', 'unit', 'หน่วย', 'หน่วยนับ'],
    required: true,
    example: ['ถุง', 'ขวด'],
  },
  { field: 'packUnit', header: 'หน่วยแพ็ค', aliases: ['packUnit', 'หน่วยใหญ่'], example: ['', 'ลัง'] },
  {
    field: 'packFactor',
    header: 'จำนวนต่อแพ็ค',
    aliases: ['packFactor', 'จำนวนต่อหน่วยแพ็ค'],
    numeric: true,
    example: ['', 12],
  },
  {
    field: 'minimumStock',
    header: 'สต๊อกขั้นต่ำ',
    aliases: ['minimumStock', 'min'],
    numeric: true,
    example: [20, 24],
  },
  {
    field: 'maximumStock',
    header: 'สต๊อกสูงสุด',
    aliases: ['maximumStock', 'max'],
    numeric: true,
    example: [200, 240],
  },
  {
    field: 'defaultCost',
    header: 'ต้นทุนต่อหน่วยหลัก',
    aliases: ['defaultCost', 'ต้นทุน', 'ราคาทุน', 'ต้นทุนต่อหน่วย'],
    numeric: true,
    example: [180, 55],
  },
  { field: 'tags', header: 'แท็ก', aliases: ['tags', 'tag'], example: ['portion', ''] },
  {
    field: 'consignmentOwner',
    header: 'เจ้าของสินค้าฝากขาย',
    aliases: ['consignmentOwner', 'เจ้าของสินค้า', 'ฝากขาย'],
    example: ['', ''],
  },
  { field: 'description', header: 'รายละเอียด', aliases: ['description', 'หมายเหตุ'], example: ['', ''] },
  { field: 'zone', header: 'Zone ยอดยกมา', aliases: ['zone', 'Zone', 'โซน'], example: ['ห้องเย็น', 'คลังสินค้า'] },
  {
    field: 'openingQuantity',
    header: 'ยอดยกมา',
    aliases: ['openingQuantity', 'คงเหลือ', 'ยอดคงเหลือ'],
    numeric: true,
    example: [90, 38],
  },
]

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

export interface MappedImport {
  rows: ImportIngredientRow[]
  /** Template headers that were not found in the file (only required ones block the import). */
  missingRequired: string[]
  /** Headers in the file that matched no column -- ignored. */
  ignoredHeaders: string[]
}

/** Maps raw sheet cells (first row = headers) to API rows. Blank rows are dropped. */
export function mapSheetToImportRows(cells: SheetCell[][]): MappedImport {
  const [headerRow = [], ...dataRows] = cells
  const columnIndex = new Map<ImportField, number>()
  const ignoredHeaders: string[] = []
  headerRow.forEach((header, index) => {
    const key = normalizeHeader(header)
    if (!key) {
      return
    }
    const column = INGREDIENT_IMPORT_COLUMNS.find(
      (candidate) =>
        normalizeHeader(candidate.header) === key || candidate.aliases.some((alias) => normalizeHeader(alias) === key),
    )
    if (column && !columnIndex.has(column.field)) {
      columnIndex.set(column.field, index)
    } else {
      ignoredHeaders.push(String(header))
    }
  })

  const missingRequired = INGREDIENT_IMPORT_COLUMNS.filter(
    (column) => column.required && !columnIndex.has(column.field),
  ).map((column) => column.header)

  const rows = dataRows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((cell) => cell !== null && String(cell).trim() !== ''))
    .map(({ row, rowNumber }) => {
      const mapped: Record<string, string | number> = {}
      for (const column of INGREDIENT_IMPORT_COLUMNS) {
        const index = columnIndex.get(column.field)
        const raw = index === undefined ? null : row[index]
        if (raw === null || raw === undefined || String(raw).trim() === '') {
          continue
        }
        if (column.numeric) {
          const parsed = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim())
          // Non-numeric text is passed through so the API reports it on that row instead of silently dropping it.
          mapped[column.field] = Number.isFinite(parsed) ? parsed : String(raw)
        } else {
          mapped[column.field] = String(raw).trim()
        }
      }
      return {
        name: '',
        category: '',
        baseUnit: '',
        ...mapped,
        rowNumber,
      } as ImportIngredientRow
    })

  return { rows, missingRequired, ignoredHeaders }
}

/** Header row + example rows for the downloadable template. */
export function buildTemplateSheet(): Array<Array<string | number>> {
  return [
    INGREDIENT_IMPORT_COLUMNS.map((column) => column.header),
    INGREDIENT_IMPORT_COLUMNS.map((column) => column.example[0]),
    INGREDIENT_IMPORT_COLUMNS.map((column) => column.example[1]),
  ]
}
