import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { STOCK_OUT_REASON_LABEL } from '@/constants/labels'
import { STOCK_OUT_REASONS, type Ingredient, type StockMovement, type StockOutReason, type Unit } from '@/types/entities'
import { formatNumber, formatQuantity } from '@/utils/format'
import { getBaseUnit, getUnitOptions, type UnitOption } from '@/utils/units'

/**
 * Optional non-negative number typed into an <input type="number">. Kept as a string in the
 * form so a blank box stays "not given" instead of being coerced to 0.
 */
export const optionalAmountSchema = z
  .string()
  .optional()
  .refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), 'กรุณากรอกตัวเลขที่ไม่ติดลบ')

export function toOptionalNumber(value: string | undefined): number | undefined {
  return value && value.trim() !== '' ? Number(value) : undefined
}

/** Movements store unit *codes* (BOTTLE, CASE); this maps them to the Thai unit name for display. */
export function buildUnitNameByCode(units: Unit[] | undefined): Map<string, string> {
  return new Map((units ?? []).map((unit) => [unit.code, unit.name]))
}

/** "2 ลัง (24 ขวด)" when the movement was keyed in a non-base unit, otherwise "24 ขวด". */
export function formatKeyedQuantity(
  row: Pick<StockMovement, 'quantity' | 'unit' | 'inputQuantity' | 'inputUnit'>,
  unitNameByCode: Map<string, string>,
): string {
  const baseText = formatQuantity(row.quantity, unitNameByCode.get(row.unit) ?? row.unit)
  const keyedText = formatInputQuantity(row, unitNameByCode)
  return keyedText ? `${keyedText} (${baseText})` : baseText
}

/** "2 ลัง" when the movement was keyed in a unit other than the base unit, otherwise null. */
export function formatInputQuantity(
  row: Pick<StockMovement, 'unit' | 'inputQuantity' | 'inputUnit'>,
  unitNameByCode: Map<string, string>,
): string | null {
  if (row.inputQuantity == null || !row.inputUnit || row.inputUnit === row.unit) {
    return null
  }
  return formatQuantity(row.inputQuantity, unitNameByCode.get(row.inputUnit) ?? row.inputUnit)
}

/** Thai label for a stock-out reason; free-text reasons (adjustments, waste) are shown as-is. */
export function formatMovementReason(reason: string | null | undefined): string | null {
  if (!reason) {
    return null
  }
  return (STOCK_OUT_REASONS as readonly string[]).includes(reason) ? STOCK_OUT_REASON_LABEL[reason as StockOutReason] : reason
}

/** Local-date "2026-11-01" for export file names (toISOString would roll back a day before 07:00 in Thailand). */
export function todayStamp(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatWeight(weight: number | null | undefined): string {
  return weight == null ? '-' : formatNumber(weight)
}

/**
 * The largest pack unit (ลัง/ถุง) defined on the ingredient itself, the same one
 * formatPackBreakdown() uses. Null when the ingredient has no pack conversion.
 */
export function getLargestPackUnit(ingredient: Ingredient | undefined, units: Unit[] | undefined): UnitOption | null {
  const packConversionIds = new Set((ingredient?.unitConversions ?? []).map((conversion) => conversion.unitId))
  const packs = getUnitOptions(ingredient, units).filter(
    (option) => !option.isBase && option.factor > 1 && packConversionIds.has(option.unitId),
  )
  if (packs.length === 0) {
    return null
  }
  return packs.reduce((largest, option) => (option.factor > largest.factor ? option : largest))
}

export function getBaseUnitName(ingredient: Ingredient | undefined, units: Unit[] | undefined): string {
  return getBaseUnit(ingredient, units)?.name ?? ''
}

/**
 * Resets a unit field to the ingredient's base unit whenever a different ingredient is picked
 * (or the unit list arrives), so a "ลัง" chosen for one item never leaks onto the next.
 */
export function useResetUnitOnIngredientChange(
  ingredient: Ingredient | undefined,
  units: Unit[] | undefined,
  setUnitId: (unitId: string) => void,
): void {
  const ingredientId = ingredient?._id
  const baseUnitId = getBaseUnit(ingredient, units)?._id ?? ''
  const setUnitIdRef = useRef(setUnitId)
  useEffect(() => {
    setUnitIdRef.current = setUnitId
  })
  useEffect(() => {
    // ingredientId is a dependency on purpose: two items can share a base unit (ขวด) but a
    // pack unit picked for the first must still be cleared when switching to the second.
    setUnitIdRef.current(baseUnitId)
  }, [ingredientId, baseUnitId])
}
