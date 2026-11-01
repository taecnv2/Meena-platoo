/**
 * Client-side mirror of apps/api/src/production/production-cost.util.ts and the yield/total-cost
 * logic in ProductionService.create -- used only for the live preview before submit; the API's
 * numbers on the saved batch are authoritative.
 */

export interface PreviewInput {
  /** Quantity as entered, in the chosen unit. */
  quantity: number
  /** Base units per entered unit (1 for the base unit). */
  factor: number
  /** Cost per entered unit when typed in, otherwise undefined (falls back to defaultCostPerBase). */
  unitCost: number | undefined
  /** The raw ingredient's standard cost per base unit. */
  defaultCostPerBase: number
  /** kg per base unit when the raw ingredient's base unit is a weight unit; null otherwise. */
  kgPerBaseUnit: number | null
}

export interface PreviewOutput {
  quantity: number
  factor: number
  /** Grams per entered unit. */
  portionWeight: number | undefined
}

export interface PreviewOutputCost {
  baseQuantity: number
  /** Cost per base unit of this output. */
  costPerBaseUnit: number
  /** Cost per entered unit (= costPerBaseUnit x factor). */
  costPerEnteredUnit: number
  totalCost: number
}

export interface ProductionPreview {
  totalCost: number
  byWeight: boolean
  outputs: PreviewOutputCost[]
  yieldPercent: number | null
}

const round2 = (value: number) => Math.round(value * 100) / 100
const round4 = (value: number) => Math.round(value * 10000) / 10000

export function computeProductionPreview(input: PreviewInput, outputs: PreviewOutput[]): ProductionPreview {
  const inputBaseQuantity = round4(input.quantity * input.factor)
  const costPerBase = input.unitCost !== undefined ? input.unitCost / input.factor : input.defaultCostPerBase
  const totalCost = round2(costPerBase * inputBaseQuantity)

  const byWeight = outputs.length > 0 && outputs.every((output) => output.portionWeight !== undefined && output.portionWeight > 0)
  const baseQuantities = outputs.map((output) => round4(output.quantity * output.factor))
  const weights = outputs.map((output, index) =>
    byWeight ? output.quantity * (output.portionWeight ?? 0) : baseQuantities[index],
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  const outputCosts = outputs.map((output, index) => {
    const baseQuantity = baseQuantities[index]
    const share = totalWeight > 0 ? (totalCost * weights[index]) / totalWeight : 0
    const costPerBaseUnit = baseQuantity > 0 ? round4(share / baseQuantity) : 0
    return {
      baseQuantity,
      costPerBaseUnit,
      costPerEnteredUnit: costPerBaseUnit * output.factor,
      totalCost: round2(costPerBaseUnit * baseQuantity),
    }
  })

  let yieldPercent: number | null = null
  if (input.kgPerBaseUnit !== null && input.kgPerBaseUnit > 0 && byWeight) {
    const inputKg = inputBaseQuantity * input.kgPerBaseUnit
    const outputKg = outputs.reduce((sum, output) => sum + (output.quantity * (output.portionWeight ?? 0)) / 1000, 0)
    yieldPercent = inputKg > 0 ? round2((outputKg / inputKg) * 100) : null
  }

  return { totalCost, byWeight, outputs: outputCosts, yieldPercent }
}
