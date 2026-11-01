import type { Ingredient, Unit } from '@/types/entities'
import { formatNumber } from './format'

/** A unit an ingredient can be keyed in, with how many base units one of it holds. */
export interface UnitOption {
  unitId: string
  code: string
  name: string
  /** 1 of this unit = factor x the ingredient's base unit. */
  factor: number
  isBase: boolean
}

const SCALED_TYPES = ['WEIGHT', 'VOLUME']

/**
 * Units an ingredient can be entered in -- mirrors the API's resolveConversionFactor():
 * the base unit, the ingredient's own pack conversions (ลัง/ถุง), then same-scale
 * weight/volume units (g for a kg item). The base unit always comes first.
 */
export function getUnitOptions(ingredient: Ingredient | undefined, units: Unit[] | undefined): UnitOption[] {
  if (!ingredient || !units) {
    return []
  }
  const unitById = new Map(units.map((unit) => [unit._id, unit]))
  const base = unitById.get(ingredient.baseUnitId)
  if (!base) {
    return []
  }
  const options: UnitOption[] = [{ unitId: base._id, code: base.code, name: base.name, factor: 1, isBase: true }]
  for (const conversion of ingredient.unitConversions ?? []) {
    const unit = unitById.get(conversion.unitId)
    if (unit && conversion.factor > 0) {
      options.push({ unitId: unit._id, code: unit.code, name: unit.name, factor: conversion.factor, isBase: false })
    }
  }
  if (SCALED_TYPES.includes(base.type) && base.conversionFactor > 0) {
    for (const unit of units) {
      const alreadyListed = options.some((option) => option.unitId === unit._id)
      if (!alreadyListed && unit.status === 'ACTIVE' && unit.type === base.type && unit.conversionFactor > 0) {
        options.push({
          unitId: unit._id,
          code: unit.code,
          name: unit.name,
          factor: unit.conversionFactor / base.conversionFactor,
          isBase: false,
        })
      }
    }
  }
  return options
}

export function getBaseUnit(ingredient: Ingredient | undefined, units: Unit[] | undefined): Unit | undefined {
  return ingredient ? units?.find((unit) => unit._id === ingredient.baseUnitId) : undefined
}

/**
 * "2 ลัง 3 ขวด" style breakdown of a base-unit quantity using the ingredient's largest pack
 * conversion -- the "เศษ" (loose remainder) staff used to note in the sheets. Null when the
 * ingredient has no pack unit or the quantity is less than one pack.
 */
export function formatPackBreakdown(
  quantity: number,
  ingredient: Ingredient | undefined,
  units: Unit[] | undefined,
): string | null {
  const options = getUnitOptions(ingredient, units).filter(
    (option) => !option.isBase && option.factor > 1 && (ingredient?.unitConversions ?? []).some((c) => c.unitId === option.unitId),
  )
  const base = getBaseUnit(ingredient, units)
  if (options.length === 0 || !base || quantity <= 0) {
    return null
  }
  const pack = options.reduce((largest, option) => (option.factor > largest.factor ? option : largest))
  const packs = Math.floor(quantity / pack.factor + 1e-9)
  if (packs < 1) {
    return null
  }
  const loose = Math.round((quantity - packs * pack.factor) * 10000) / 10000
  return loose > 0
    ? `${formatNumber(packs)} ${pack.name} ${formatNumber(loose)} ${base.name}`
    : `${formatNumber(packs)} ${pack.name}`
}
