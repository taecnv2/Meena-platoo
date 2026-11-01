import type { ImportIngredientRow } from '@/types/entities'
import { INGREDIENT_IMPORT_COLUMNS } from '../ingredientImportColumns'

/** The API accepts at most this many rows per request (ImportIngredientsDto @ArrayMaxSize). */
export const MAX_IMPORT_ROWS = 3000

/** Numeric columns the API validates with @Min(0); a negative value would reject the whole request. */
const NON_NEGATIVE_FIELDS = new Set<keyof ImportIngredientRow>(['minimumStock', 'maximumStock', 'defaultCost', 'openingQuantity'])

/**
 * Problems the API's request-level validation (class-validator) would reject the *whole* upload
 * for -- text in a number column, negative numbers. Caught here so staff get a row-by-row list
 * instead of one generic error. Row numbers match the API's (header = row 1).
 */
export function findBlockingRowIssues(rows: ImportIngredientRow[]): string[] {
  const issues: string[] = []
  rows.forEach((row, index) => {
    const rowNumber = row.rowNumber ?? index + 2
    for (const column of INGREDIENT_IMPORT_COLUMNS) {
      if (!column.numeric) {
        continue
      }
      const value = row[column.field]
      if (value === undefined) {
        continue
      }
      if (typeof value !== 'number') {
        issues.push(`แถวที่ ${rowNumber}: คอลัมน์ "${column.header}" ต้องเป็นตัวเลข (พบ "${String(value)}")`)
      } else if (NON_NEGATIVE_FIELDS.has(column.field) && value < 0) {
        issues.push(`แถวที่ ${rowNumber}: คอลัมน์ "${column.header}" ต้องไม่ติดลบ`)
      }
    }
  })
  return issues
}
