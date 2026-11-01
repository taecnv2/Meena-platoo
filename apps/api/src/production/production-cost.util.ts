export interface CostOutput {
  /** Base-unit quantity produced. */
  baseQuantity: number;
  /** Quantity as entered (multiplied by portionWeight for the weight split). */
  inputQuantity: number;
  /** Grams per entered unit, if known. */
  portionWeight?: number | null;
}

/**
 * Splits a batch's raw cost across its outputs and returns the cost per base unit of each.
 * By weight when every output has a portionWeight (a 165 g sashimi bag costs more than a
 * 100 g one), otherwise evenly per base unit produced.
 */
export function allocateProductionCost(
  totalCost: number,
  outputs: CostOutput[],
): number[] {
  const byWeight = outputs.every(
    (output) => output.portionWeight && output.portionWeight > 0,
  );
  const weights = outputs.map((output) =>
    byWeight
      ? output.inputQuantity * (output.portionWeight ?? 0)
      : output.baseQuantity,
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return outputs.map(() => 0);
  }
  return outputs.map((output, index) => {
    const share = (totalCost * weights[index]) / totalWeight;
    return output.baseQuantity > 0 ? round4(share / output.baseQuantity) : 0;
  });
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
